import { AuthApi, ApiError } from './api.js';
import { guardRoute, renderShell } from './shell.js';
import {
  clearSession,
  isAuthenticated,
  markBootstrapped,
  setConfig,
  setSession,
} from './state.js';
import { el, mount, notice, toast } from './ui.js';
import { defaultRoute, navigate, normalizePath } from './router.js';
import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderTables } from './views/tables.js';
import { renderReservations } from './views/reservations.js';
import { renderOrders } from './views/orders.js';
import { renderKitchen } from './views/kitchen.js';
import { renderDispatch } from './views/dispatch.js';
import { renderUsers } from './views/users.js';

const appRoot = document.getElementById('app');
let cleanupView = null;

const VIEW_RENDERERS = {
  dashboard: renderDashboard,
  tables: renderTables,
  reservations: renderReservations,
  orders: renderOrders,
  kitchen: renderKitchen,
  dispatch: renderDispatch,
  users: renderUsers,
};

function bootScreen(copy = 'Preparando el servicio…') {
  return el('div', { className: 'boot-screen', role: 'status', 'aria-live': 'polite' }, [
    el('div', { className: 'boot-mark', text: 'CP', 'aria-hidden': 'true' }),
    el('p', { className: 'boot-name', text: 'Café Paris' }),
    el('p', { className: 'boot-copy', text: copy }),
  ]);
}

function forbiddenPage() {
  return el('div', { className: 'state-page' }, [
    el('h1', { text: 'Sin acceso' }),
    el('p', { text: 'Tu rol no tiene permiso para esta sección.' }),
    el('button', {
      type: 'button',
      className: 'btn btn-primary',
      text: 'Ir al inicio',
      onClick: () => {
        const home = defaultRoute();
        navigate(home?.path || '/', { replace: true });
      },
    }),
  ]);
}

async function bootstrapSession() {
  const config = await AuthApi.config();
  setConfig(config);

  try {
    const me = await AuthApi.me();
    setSession({
      user: me.user,
      permissions: me.permissions,
      today: me.today,
      time: me.time,
      timezone: me.timezone,
      demoMode: me.demoMode,
      restaurantName: me.restaurantName,
    });
  } catch (err) {
    clearSession();
    if (!(err instanceof ApiError && err.status === 401)) {
      // sesión ausente es normal; otros errores se avisan
      if (err instanceof ApiError && err.status !== 401) {
        toast(err.message || 'No se pudo verificar la sesión', 'error');
      }
    }
  }
}

async function renderApp() {
  if (cleanupView) {
    cleanupView();
    cleanupView = null;
  }

  const path = normalizePath(window.location.pathname);

  if (!isAuthenticated()) {
    if (path !== '/acceso') {
      navigate('/acceso', { replace: true });
      return;
    }
    await renderLogin(appRoot);
    document.title = 'Acceso · Café Paris';
    return;
  }

  if (path === '/acceso') {
    const home = defaultRoute();
    navigate(home?.path || '/', { replace: true });
    return;
  }

  const route = guardRoute();
  if (!route) return;

  const contentHost = el('div', { className: 'view-host' });
  renderShell(appRoot, { route, content: contentHost });
  document.title = `${route.title} · Café Paris`;

  const renderer = VIEW_RENDERERS[route.id];
  if (!renderer) {
    mount(contentHost, forbiddenPage());
    return;
  }

  try {
    const maybeCleanup = await renderer(contentHost);
    if (typeof maybeCleanup === 'function') cleanupView = maybeCleanup;
  } catch (err) {
    mount(contentHost, notice('danger', 'Error de vista', err.message || 'Error inesperado'));
    toast(err.message || 'Error al renderizar', 'error');
  }
}

function bindHistory() {
  window.addEventListener('popstate', () => {
    renderApp();
  });
  window.addEventListener('session-expired', (event) => {
    clearSession();
    toast(event.detail?.message || 'Tu sesión expiró. Inicia sesión de nuevo.', 'error');
    renderApp();
  });
}

async function start() {
  mount(appRoot, bootScreen());
  bindHistory();

  try {
    await bootstrapSession();
    markBootstrapped();
    await renderApp();
  } catch (err) {
    mount(appRoot, el('div', { className: 'state-page' }, [
      el('h1', { text: 'No se pudo iniciar' }),
      el('p', { text: err.message || 'Comprueba que el servidor esté en marcha.' }),
      el('button', {
        type: 'button',
        className: 'btn btn-primary',
        text: 'Reintentar',
        onClick: () => start(),
      }),
    ]));
  }
}

start();
