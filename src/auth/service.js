import { db, nowIso, transaction } from '../db/index.js';
import { AppError } from '../domain/errors.js';
import { verifyGoogleIdToken } from './google.js';
import { getDummyHash, verifyPassword } from './passwords.js';
import { toPublicUser } from './sessions.js';

const GENERIC_LOGIN_ERROR = 'Correo o contraseña incorrectos.';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function authenticateWithPassword(email, password) {
  const row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
  const dummyHash = row ? null : await getDummyHash();
  const passwordHash = row?.password_hash || dummyHash;
  const valid = await verifyPassword(passwordHash, password);

  if (!row || !valid || !row.active) {
    await delay(150);
    throw new AppError(401, 'invalid_credentials', GENERIC_LOGIN_ERROR);
  }

  return toPublicUser(row);
}

export async function verifyGoogleIdentity(idToken, expectedNonces) {
  return verifyGoogleIdToken(idToken, expectedNonces);
}

export function authenticateWithGoogleIdentity(identity) {
  const user = transaction(() => {
    let row = db.prepare('SELECT * FROM users WHERE google_sub = ?').get(identity.sub);

    if (!row) {
      row = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(identity.email);
      if (!row) {
        throw new AppError(
          401,
          'google_unlinked',
          'Esta cuenta de Google no está vinculada. Pide a un administrador que cree tu usuario.',
        );
      }
      if (!row.active) {
        throw new AppError(401, 'google_unlinked', 'Esta cuenta está desactivada.');
      }
      if (row.google_sub && row.google_sub !== identity.sub) {
        throw new AppError(401, 'google_unlinked', 'Esta cuenta ya está vinculada a otra identidad de Google.');
      }
      if (!row.google_sub) {
        db.prepare('UPDATE users SET google_sub = ?, updated_at = ? WHERE id = ? AND google_sub IS NULL')
          .run(identity.sub, nowIso(), row.id);
        row = db.prepare('SELECT * FROM users WHERE id = ?').get(row.id);
      }
    }

    if (!row.active) {
      throw new AppError(401, 'google_unlinked', 'Esta cuenta está desactivada.');
    }
    return row;
  });

  return toPublicUser(user);
}
