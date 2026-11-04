import crypto from 'node:crypto';
import {
  validatePasswordReset,
  validateUserCreate,
  validateUserUpdate,
} from '../../shared/validation.js';
import { db, nowIso, transaction } from '../db/index.js';
import { generateTemporaryPassword, hashPassword } from '../auth/passwords.js';
import { destroyAllSessionsForUser } from '../auth/sessions.js';
import { conflict, notFound, validationError } from './errors.js';
import { assertUuid } from './ids.js';

export function serializeUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: Boolean(row.active),
    isDemo: Boolean(row.is_demo),
    googleLinked: Boolean(row.google_sub),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listUsers() {
  return db.prepare('SELECT * FROM users ORDER BY created_at ASC').all().map(serializeUser);
}

function getUserRow(id) {
  assertUuid(id);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) throw notFound('El usuario no existe.');
  return row;
}

function countOtherActiveAdmins(excludeId) {
  return db.prepare(`
    SELECT COUNT(*) AS count FROM users
    WHERE role = 'admin' AND active = 1 AND id <> ?
  `).get(excludeId).count;
}

export async function createUser(input) {
  const result = validateUserCreate(input);
  if (!result.valid) throw validationError(result.errors);

  const duplicate = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(result.data.email);
  if (duplicate) throw validationError({ email: 'Ya existe un usuario con este correo.' });

  const generated = !result.data.password;
  const plainPassword = result.data.password || generateTemporaryPassword();
  const passwordHash = await hashPassword(plainPassword);
  const id = crypto.randomUUID();
  const now = nowIso();

  try {
    db.prepare(`
      INSERT INTO users (id, name, email, role, password_hash, active, is_demo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)
    `).run(id, result.data.name, result.data.email, result.data.role, passwordHash, now, now);
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE')) {
      throw validationError({ email: 'Ya existe un usuario con este correo.' });
    }
    throw error;
  }

  return {
    user: serializeUser(getUserRow(id)),
    temporaryPassword: generated ? plainPassword : null,
  };
}

export function updateUser(actorId, targetId, input) {
  const target = getUserRow(targetId);
  const result = validateUserUpdate(input);
  if (!result.valid) throw validationError(result.errors);

  const nextRole = result.data.role ?? target.role;
  const nextActive = result.data.active ?? target.active;

  if (target.id === actorId && nextActive === 0) {
    throw conflict('No puedes desactivar tu propia cuenta.');
  }

  const losesAdmin = target.role === 'admin' && (nextRole !== 'admin' || nextActive === 0);
  if (losesAdmin && countOtherActiveAdmins(target.id) === 0) {
    throw conflict('Debe quedar al menos un administrador activo.');
  }

  transaction(() => {
    db.prepare(`
      UPDATE users SET name = ?, role = ?, active = ?, updated_at = ? WHERE id = ?
    `).run(
      result.data.name ?? target.name,
      nextRole,
      nextActive,
      nowIso(),
      target.id,
    );
  });

  if (nextActive === 0) destroyAllSessionsForUser(target.id);
  return serializeUser(getUserRow(target.id));
}

export async function resetUserPassword(actorId, targetId, input) {
  const target = getUserRow(targetId);
  const result = validatePasswordReset(input);
  if (!result.valid) throw validationError(result.errors);

  const generated = !result.data.password;
  const plainPassword = result.data.password || generateTemporaryPassword();
  const passwordHash = await hashPassword(plainPassword);

  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(passwordHash, nowIso(), target.id);
  destroyAllSessionsForUser(target.id);

  return {
    user: serializeUser(getUserRow(target.id)),
    temporaryPassword: generated ? plainPassword : null,
    sessionInvalidated: target.id === actorId,
  };
}
