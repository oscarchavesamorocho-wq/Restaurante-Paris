import { AppError } from '../domain/errors.js';

const buckets = new Map();
let lastCleanup = Date.now();

function cleanup(now) {
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit({
  windowMs = 15 * 60_000,
  max = 20,
  code = 'rate_limited',
  message = 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  keyFn = (req) => req.ip || 'unknown',
} = {}) {
  return (req, res, next) => {
    const now = Date.now();
    cleanup(now);
    const key = `${code}:${keyFn(req)}`;
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return next(
        new AppError(429, code, message),
      );
    }
    return next();
  };
}

export function resetRateLimits() {
  buckets.clear();
}
