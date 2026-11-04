import { isRealIsoDate } from '../../shared/validation.js';
import { validationError } from '../domain/errors.js';

export function sendData(res, data, status = 200) {
  return res.status(status).json({ data });
}

export function assertQueryDate(value, field = 'date') {
  if (value == null || value === '') return null;
  if (!isRealIsoDate(value)) throw validationError({ [field]: 'La fecha no es válida.' });
  return value;
}

export function assertLimit(value, max = 200) {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw validationError({ limit: `El límite debe estar entre 1 y ${max}.` });
  }
  return parsed;
}

export function assertQueryText(value, field, maxLength = 100) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw validationError({ [field]: 'El texto de búsqueda no es válido.' });
  }
  return value.trim();
}

export function assertEnum(value, allowed, field) {
  if (value == null || value === '') return null;
  if (!allowed.includes(value)) throw validationError({ [field]: 'Valor no válido.' });
  return value;
}
