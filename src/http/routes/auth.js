import { Router } from 'express';
import { ROLE_PERMISSIONS, RESTAURANT_NAME } from '../../../shared/domain.js';
import { validateLogin } from '../../../shared/validation.js';
import { googleEnabled } from '../../auth/google.js';
import {
  consumeGoogleNonce,
  createGoogleNonce,
  readGoogleNonces,
} from '../../auth/google-nonce.js';
import { requireAuth } from '../../auth/permissions.js';
import {
  authenticateWithGoogleIdentity,
  authenticateWithPassword,
  verifyGoogleIdentity,
} from '../../auth/service.js';
import {
  clearSessionCookie,
  createSession,
  currentSessionToken,
  destroySession,
  setSessionCookie,
} from '../../auth/sessions.js';
import { config } from '../../config.js';
import { AppError, validationError } from '../../domain/errors.js';
import { timeInTz, todayInTz, timezoneLabel } from '../../domain/time.js';
import { normalizeEmail } from '../../../shared/validation.js';
import { rateLimit } from '../../security/rate-limit.js';
import { sendData } from '../helpers.js';

export const authRouter = Router();

const loginIpLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 30,
  code: 'login_rate_limited',
});

const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 8,
  code: 'login_rate_limited',
  keyFn: (req) => `${req.ip || 'unknown'}|${normalizeEmail(req.body?.email)}`,
});

authRouter.get('/config', (_req, res) => {
  sendData(res, {
    restaurantName: RESTAURANT_NAME,
    googleEnabled: googleEnabled(),
    googleClientId: googleEnabled() ? config.googleClientId : null,
    demoMode: config.demoMode,
    today: todayInTz(),
    time: timeInTz(),
    timezone: timezoneLabel(),
    maxSessionHours: config.sessionHours,
  });
});

authRouter.post('/login', loginIpLimiter, loginAccountLimiter, async (req, res) => {
  const result = validateLogin(req.body);
  if (!result.valid) throw validationError(result.errors);

  const user = await authenticateWithPassword(result.data.email, result.data.password);
  const session = createSession(user.id);
  setSessionCookie(res, session.token);

  sendData(res, {
    user,
    permissions: ROLE_PERMISSIONS[user.role],
    expiresAt: session.expiresAt,
  });
});

authRouter.get('/google/nonce', (req, res) => {
  if (!googleEnabled()) {
    throw new AppError(503, 'google_disabled', 'El inicio de sesión con Google no está configurado.');
  }
  sendData(res, { nonce: createGoogleNonce(req, res) });
});

authRouter.post(
  '/google',
  loginIpLimiter,
  rateLimit({ windowMs: 15 * 60_000, max: 15, code: 'google_rate_limited' }),
  async (req, res) => {
    if (!googleEnabled()) {
      throw new AppError(503, 'google_disabled', 'El inicio de sesión con Google no está configurado.');
    }
    const credential = req.body?.credential;
    if (typeof credential !== 'string' || credential.length < 20) {
      throw validationError({ credential: 'La credencial de Google no es válida.' });
    }
    const identity = await verifyGoogleIdentity(credential, readGoogleNonces(req));
    if (!consumeGoogleNonce(req, res, identity.nonce)) {
      throw new AppError(401, 'google_invalid', 'No se pudo verificar la cuenta de Google.');
    }
    const user = authenticateWithGoogleIdentity(identity);
    const session = createSession(user.id);
    setSessionCookie(res, session.token);
    sendData(res, {
      user,
      permissions: ROLE_PERMISSIONS[user.role],
      expiresAt: session.expiresAt,
    });
  },
);

authRouter.get('/me', requireAuth, (req, res) => {
  sendData(res, {
    user: req.user,
    permissions: ROLE_PERMISSIONS[req.user.role],
    restaurantName: RESTAURANT_NAME,
    demoMode: config.demoMode,
    today: todayInTz(),
    time: timeInTz(),
    timezone: timezoneLabel(),
  });
});

authRouter.post('/logout', (req, res) => {
  const token = currentSessionToken(req);
  if (token) destroySession(token);
  clearSessionCookie(res);
  sendData(res, { ok: true });
});
