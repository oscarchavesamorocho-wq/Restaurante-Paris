import { hasPermission } from '../../shared/domain.js';
import { forbidden, unauthorized } from '../domain/errors.js';

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  return next();
}

export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!hasPermission(req.user.role, permission)) return next(forbidden());
    return next();
  };
}

export function can(role, permission) {
  return hasPermission(role, permission);
}
