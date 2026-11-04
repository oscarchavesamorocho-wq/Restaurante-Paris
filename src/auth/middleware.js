import { config } from '../config.js';
import { currentSessionToken, getSessionUser } from './sessions.js';

export function attachSession(req, _res, next) {
  const token = currentSessionToken(req);
  if (token) {
    const user = getSessionUser(token);
    if (user) req.user = user;
  }
  next();
}

export function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}

export function securityContext(req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (config.isProduction) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}
