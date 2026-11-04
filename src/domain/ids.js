import { notFound } from './errors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value, message = 'El recurso no existe.') {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw notFound(message);
  return value;
}

export function positiveInt(value, message = 'El identificador no es válido.') {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== String(value).trim()) {
    throw notFound(message);
  }
  return parsed;
}
