/**
 * Cliente HTTP del API Café Paris.
 * Sesión por cookie HttpOnly; credentials: same-origin.
 * No persiste permisos ni datos de negocio en localStorage.
 */

import { getState } from './state.js';

export class ApiError extends Error {
  constructor({ status, code, message, fields }) {
    super(message || 'Error de API');
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'unknown';
    this.fields = fields || null;
  }
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function api(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers = {},
    signal,
    authAttempt = false,
  } = options;

  const init = {
    method,
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...headers },
    signal,
  };

  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`/api${path}`, init);
  const payload = await parseBody(response);

  if (!response.ok) {
    if (response.status === 401 && !authAttempt && getState().user) {
      window.dispatchEvent(new CustomEvent('session-expired'));
    }
    const error = payload?.error || {};
    throw new ApiError({
      status: response.status,
      code: error.code,
      message: error.message || `Error ${response.status}`,
      fields: error.fields || null,
    });
  }

  return payload?.data;
}

export const AuthApi = {
  config: () => api('/auth/config'),
  me: () => api('/auth/me'),
  login: (email, password) => api('/auth/login', {
    method: 'POST',
    body: { email, password },
    authAttempt: true,
  }),
  googleNonce: () => api('/auth/google/nonce'),
  google: (credential) => api('/auth/google', {
    method: 'POST',
    body: { credential },
    authAttempt: true,
  }),
  logout: () => api('/auth/logout', { method: 'POST', body: {} }),
};

export const CatalogApi = {
  dashboard: () => api('/dashboard'),
  tables: () => api('/tables'),
  dishes: () => api('/dishes'),
};

export const ReservationsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams();
    if (params.date) q.set('date', params.date);
    if (params.status) q.set('status', params.status);
    if (params.tableId) q.set('tableId', String(params.tableId));
    if (params.q) q.set('q', params.q);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return api(`/reservations${qs ? `?${qs}` : ''}`);
  },
  get: (id) => api(`/reservations/${id}`),
  create: (body) => api('/reservations', { method: 'POST', body }),
  update: (id, body) => api(`/reservations/${id}`, { method: 'PATCH', body }),
  cancel: (id) => api(`/reservations/${id}/cancel`, { method: 'POST', body: {} }),
  complete: (id) => api(`/reservations/${id}/complete`, { method: 'POST', body: {} }),
};

export const OrdersApi = {
  list: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.tableId) q.set('tableId', String(params.tableId));
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return api(`/orders${qs ? `?${qs}` : ''}`);
  },
  get: (id) => api(`/orders/${id}`),
  create: (body) => api('/orders', { method: 'POST', body }),
  cancel: (id) => api(`/orders/${id}/cancel`, { method: 'POST', body: {} }),
};

export const KitchenApi = {
  queue: () => api('/kitchen/queue'),
  start: (id) => api(`/kitchen/items/${id}/start`, { method: 'POST', body: {} }),
  ready: (id) => api(`/kitchen/items/${id}/ready`, { method: 'POST', body: {} }),
};

export const DispatchApi = {
  ready: () => api('/dispatches/ready'),
  list: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return api(`/dispatches${qs ? `?${qs}` : ''}`);
  },
  create: (orderId) => api('/dispatches', { method: 'POST', body: { orderId } }),
  deliver: (id) => api(`/dispatches/${id}/deliver`, { method: 'POST', body: {} }),
};

export const UsersApi = {
  list: () => api('/users'),
  create: (body) => api('/users', { method: 'POST', body }),
  update: (id, body) => api(`/users/${id}`, { method: 'PATCH', body }),
  resetPassword: (id, body) => api(`/users/${id}/password`, { method: 'POST', body: body || {} }),
};

export const AdminApi = {
  resetDemo: (confirmation) => api('/admin/demo/reset', {
    method: 'POST',
    body: { confirmation },
  }),
};
