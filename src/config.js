import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function boolEnv(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function intEnv(value, fallback, min, max) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function resolveFromRoot(value, fallback) {
  const raw = value && value.trim() ? value.trim() : fallback;
  return path.isAbsolute(raw) ? raw : path.resolve(ROOT_DIR, raw);
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
if (googleClientId && !/\.apps\.googleusercontent\.com$/.test(googleClientId)) {
  throw new Error(
    'GOOGLE_CLIENT_ID no tiene el formato esperado (*.apps.googleusercontent.com). Revisa la configuración.',
  );
}

const demoMode = boolEnv(process.env.DEMO_MODE, !isProduction);

export const config = Object.freeze({
  rootDir: ROOT_DIR,
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  host: process.env.HOST || '127.0.0.1',
  port: intEnv(process.env.PORT, 3000, 1, 65535),
  appOrigin: (process.env.APP_ORIGIN || 'http://localhost:3000').replace(/\/+$/, ''),
  dbPath: resolveFromRoot(process.env.DB_PATH, './data/cafe-paris.sqlite'),
  sessionHours: intEnv(process.env.SESSION_HOURS, 8, 1, 72),
  cookieSecure: boolEnv(process.env.COOKIE_SECURE, isProduction),
  restaurantTz: process.env.RESTAURANT_TZ || 'America/Bogota',
  trustProxy: intEnv(process.env.TRUST_PROXY, 0, 0, 10),
  demoMode,
  demoAdminEmail: (process.env.DEMO_ADMIN_EMAIL || 'admin@cafeparis.local').trim().toLowerCase(),
  demoAdminPassword: process.env.DEMO_ADMIN_PASSWORD || '',
  bootstrapAdminEmail: (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase(),
  bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD || '',
  googleClientId: googleClientId || null,
  googleNonceMinutes: 10,
  googleNonceCookieName: 'cafe_paris_google_nonce',
  sessionCookieName: 'cafe_paris_session',
});

if (isProduction && config.cookieSecure === false) {
  console.warn('[config] COOKIE_SECURE=false en producción. Usa HTTPS y cookies Secure.');
}

if (isProduction && /^http:\/\/(localhost|127\.0\.0\.1)/.test(config.appOrigin)) {
  console.warn('[config] APP_ORIGIN apunta a localhost en producción. Configura el origen público real.');
}

if (isProduction && config.demoMode) {
  console.warn('[config] DEMO_MODE está activo en producción. Desactívalo tras la demostración.');
}
