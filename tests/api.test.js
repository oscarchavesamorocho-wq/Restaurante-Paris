import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-paris-test-'));
const adminEmail = 'admin@test.local';
const adminPassword = 'AdminTest123!';
const waiterEmail = 'mesero@test.local';
const waiterPassword = 'MeseroTest123!';

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(tempDir, 'test.sqlite');
process.env.DEMO_MODE = 'true';
process.env.DEMO_ADMIN_EMAIL = adminEmail;
process.env.DEMO_ADMIN_PASSWORD = adminPassword;
process.env.COOKIE_SECURE = 'false';
process.env.RESTAURANT_TZ = 'America/Bogota';
process.env.SESSION_HOURS = '8';
process.env.GOOGLE_CLIENT_ID = '';

const { ensureSeed } = await import('../src/db/seed.js');
const { closeDb } = await import('../src/db/index.js');
const { createApp } = await import('../src/app.js');

let server;
let baseUrl;

function cookieFrom(response) {
  const values = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean);
  const sessionCookie = values.find((value) => value.startsWith('cafe_paris_session='));
  return sessionCookie?.split(';')[0] || null;
}

async function request(method, endpoint, {
  body,
  cookie,
  origin = baseUrl,
  headers = {},
} = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(origin ? { Origin: origin } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  return { response, payload, text };
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

before(async () => {
  await ensureSeed();
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('flujo principal de la API con permisos, cocina, despacho y reset demo', async () => {
  const health = await request('GET', '/api/health', { origin: null });
  assert.equal(health.response.status, 200);
  assert.equal(health.payload.data.status, 'ok');

  const publicConfig = await request('GET', '/api/auth/config', { origin: null });
  assert.equal(publicConfig.response.status, 200);
  assert.equal(publicConfig.payload.data.demoMode, true);
  assert.equal(publicConfig.payload.data.googleEnabled, false);
  assert.match(publicConfig.payload.data.today, /^\d{4}-\d{2}-\d{2}$/);

  const googleNonce = await request('GET', '/api/auth/google/nonce', { origin: null });
  assert.equal(googleNonce.response.status, 503);
  assert.equal(googleNonce.payload.error.code, 'google_disabled');

  const googleLogin = await request('POST', '/api/auth/google', {
    body: { credential: 'x'.repeat(40) },
  });
  assert.equal(googleLogin.response.status, 503);
  assert.equal(googleLogin.payload.error.code, 'google_disabled');

  const anonymousMe = await request('GET', '/api/auth/me', { origin: null });
  assert.equal(anonymousMe.response.status, 401);

  const noOriginLogin = await request('POST', '/api/auth/login', {
    body: { email: adminEmail, password: adminPassword },
    origin: null,
  });
  assert.equal(noOriginLogin.response.status, 403);
  assert.equal(noOriginLogin.payload.error.code, 'csrf_rejected');

  const adminLogin = await request('POST', '/api/auth/login', {
    body: { email: adminEmail, password: adminPassword },
  });
  assert.equal(adminLogin.response.status, 200);
  assert.equal(adminLogin.payload.data.user.role, 'admin');
  const adminCookie = cookieFrom(adminLogin.response);
  assert.ok(adminCookie);

  const adminMe = await request('GET', '/api/auth/me', { cookie: adminCookie });
  assert.equal(adminMe.response.status, 200);
  assert.ok(adminMe.payload.data.permissions.includes('demo:reset'));

  const reservation = await request('POST', '/api/reservations', {
    cookie: adminCookie,
    body: {
      tableId: 1,
      customerName: 'Prueba de Integración',
      customerPhone: '+57 300 123 4567',
      date: addDays(publicConfig.payload.data.today, 1),
      time: '19:00',
      people: 2,
      notes: 'Reserva creada por la prueba automática.',
    },
  });
  assert.equal(reservation.response.status, 201);
  assert.equal(reservation.payload.data.customerName, 'Prueba de Integración');
  assert.equal(reservation.payload.data.status, 'activa');

  const order = await request('POST', '/api/orders', {
    cookie: adminCookie,
    body: {
      tableId: 3,
      notes: 'Pedido creado por la prueba automática.',
      items: [{ dishId: 1, quantity: 2, notes: 'Sin azúcar' }],
    },
  });
  assert.equal(order.response.status, 201);
  const orderId = order.payload.data.id;
  assert.ok(orderId);

  const queue = await request('GET', '/api/kitchen/queue', { cookie: adminCookie });
  assert.equal(queue.response.status, 200);
  const queuedItem = queue.payload.data.find((item) => item.orderId === orderId);
  assert.ok(queuedItem, 'El pedido debe aparecer en la cola de cocina');

  const started = await request('POST', `/api/kitchen/items/${queuedItem.id}/start`, {
    cookie: adminCookie,
    body: {},
  });
  assert.equal(started.response.status, 200);
  assert.equal(started.payload.data.status, 'preparando');

  const ready = await request('POST', `/api/kitchen/items/${queuedItem.id}/ready`, {
    cookie: adminCookie,
    body: {},
  });
  assert.equal(ready.response.status, 200);
  assert.equal(ready.payload.data.status, 'listo');

  const readyGroups = await request('GET', '/api/dispatches/ready', { cookie: adminCookie });
  assert.equal(readyGroups.response.status, 200);
  const readyGroup = readyGroups.payload.data.find((group) => group.orderId === orderId);
  assert.ok(readyGroup, 'El pedido debe aparecer listo para despacho');

  const dispatch = await request('POST', '/api/dispatches', {
    cookie: adminCookie,
    body: { orderId },
  });
  assert.equal(dispatch.response.status, 201);
  assert.equal(dispatch.payload.data.status, 'en_ruta');
  assert.equal(dispatch.payload.data.itemCount, 2);

  const delivered = await request('POST', `/api/dispatches/${dispatch.payload.data.id}/deliver`, {
    cookie: adminCookie,
    body: {},
  });
  assert.equal(delivered.response.status, 200);
  assert.equal(delivered.payload.data.status, 'entregado');
  assert.ok(delivered.payload.data.deliveredAt);

  const createdWaiter = await request('POST', '/api/users', {
    cookie: adminCookie,
    body: {
      name: 'Mesero de Prueba',
      email: waiterEmail,
      role: 'mesero',
      password: waiterPassword,
    },
  });
  assert.equal(createdWaiter.response.status, 201);

  const waiterLogin = await request('POST', '/api/auth/login', {
    body: { email: waiterEmail, password: waiterPassword },
  });
  assert.equal(waiterLogin.response.status, 200);
  assert.equal(waiterLogin.payload.data.user.role, 'mesero');
  const waiterCookie = cookieFrom(waiterLogin.response);
  assert.ok(waiterCookie);

  const forbiddenUsers = await request('GET', '/api/users', { cookie: waiterCookie });
  assert.equal(forbiddenUsers.response.status, 403);
  assert.equal(forbiddenUsers.payload.error.code, 'forbidden');

  const reset = await request('POST', '/api/admin/demo/reset', {
    cookie: adminCookie,
    body: { confirmation: 'RESTABLECER' },
  });
  assert.equal(reset.response.status, 200);
  assert.equal(reset.payload.data.tables, 8);
  assert.equal(reset.payload.data.dishes, 8);
  assert.equal(reset.payload.data.reservations, 2);
  assert.equal(reset.payload.data.orders, 2);
});
