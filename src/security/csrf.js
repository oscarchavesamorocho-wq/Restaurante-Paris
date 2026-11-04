import { config } from '../config.js';
import { AppError } from '../domain/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originFromReferer(referer) {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const requestOrigin = `${req.protocol}://${req.get('host')}`;
  const provided = req.get('origin') || originFromReferer(req.get('referer'));
  const allowed = new Set([config.appOrigin, requestOrigin]);

  if (!provided || !allowed.has(provided)) {
    return next(
      new AppError(403, 'csrf_rejected', 'Origen de la petición no permitido.'),
    );
  }
  return next();
}
