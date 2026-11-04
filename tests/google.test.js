import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-paris-google-test-'));
const clientId = '1234567890-test.apps.googleusercontent.com';

process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(tempDir, 'test.sqlite');
process.env.DEMO_MODE = 'true';
process.env.DEMO_ADMIN_EMAIL = 'admin@google-test.local';
process.env.DEMO_ADMIN_PASSWORD = 'AdminTest123!';
process.env.COOKIE_SECURE = 'false';
process.env.RESTAURANT_TZ = 'America/Bogota';
process.env.SESSION_HOURS = '8';
process.env.GOOGLE_CLIENT_ID = clientId;

const { ensureSeed } = await import('../src/db/seed.js');
const { closeDb } = await import('../src/db/index.js');
const { createApp } = await import('../src/app.js');
const {
  consumeGoogleNonce,
  createGoogleNonce,
  readGoogleNonces,
} = await import('../src/auth/google-nonce.js');

let server;
let baseUrl;

function setCookie(response, name) {
  const values = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean);
  return values.find((value) => value.startsWith(`${name}=`)) || null;
}

async function request(method, endpoint, { body, cookie, origin = baseUrl } = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
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
  if (server) await new Promise((resolve) => server.close(resolve));
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('el nonce de Google se consume una sola vez', () => {
  const req = { cookies: {} };
  const res = {
    cookie(name, value) {
      req.cookies[name] = value;
    },
    clearCookie(name) {
      delete req.cookies[name];
    },
  };

  const first = createGoogleNonce(req, res);
  const second = createGoogleNonce(req, res);
  assert.deepEqual(readGoogleNonces(req), [first, second]);

  assert.equal(consumeGoogleNonce(req, res, first), true);
  assert.deepEqual(readGoogleNonces(req), [second]);
  assert.equal(consumeGoogleNonce(req, res, first), false);
  assert.equal(consumeGoogleNonce(req, res, second), true);
  assert.deepEqual(readGoogleNonces(req), []);
});

test('Google habilitado emite nonce y rechaza credenciales no válidas', async () => {
  const publicConfig = await request('GET', '/api/auth/config', { origin: null });
  assert.equal(publicConfig.response.status, 200);
  assert.equal(publicConfig.payload.data.googleEnabled, true);
  assert.equal(publicConfig.payload.data.googleClientId, clientId);

  const nonceResponse = await request('GET', '/api/auth/google/nonce', { origin: null });
  assert.equal(nonceResponse.response.status, 200);
  assert.match(nonceResponse.payload.data.nonce, /^[A-Za-z0-9_-]{32,64}$/);

  const nonceCookie = setCookie(nonceResponse.response, 'cafe_paris_google_nonce');
  assert.ok(nonceCookie);
  assert.match(nonceCookie, /HttpOnly/i);
  assert.match(nonceCookie, /SameSite=Strict/i);
  assert.match(nonceCookie, /Max-Age=600/i);
  const cookiePair = nonceCookie.split(';')[0];

  const withoutNonce = await request('POST', '/api/auth/google', {
    body: { credential: 'x'.repeat(40) },
  });
  assert.equal(withoutNonce.response.status, 401);
  assert.equal(withoutNonce.payload.error.code, 'google_invalid');

  const invalidToken = await request('POST', '/api/auth/google', {
    body: { credential: 'x'.repeat(40) },
    cookie: cookiePair,
  });
  assert.equal(invalidToken.response.status, 401);
  assert.equal(invalidToken.payload.error.code, 'google_invalid');
});
