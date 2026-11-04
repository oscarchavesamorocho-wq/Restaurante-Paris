import crypto from 'node:crypto';
import { config } from '../config.js';
import { db, nowIso, purgeExpiredSessions } from '../db/index.js';
import { unauthorized } from '../domain/errors.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: Boolean(row.active),
    isDemo: Boolean(row.is_demo),
    googleLinked: Boolean(row.google_sub),
  };
}

export function createSession(userId) {
  purgeExpiredSessions();
  const token = crypto.randomBytes(32).toString('base64url');
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + config.sessionHours * 3_600_000).toISOString();
  db.prepare(`
    INSERT INTO sessions (token_hash, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(hashToken(token), userId, createdAt, expiresAt);
  return { token, expiresAt };
}

export function getSessionUser(token) {
  if (!token || typeof token !== 'string' || token.length > 200) return null;
  const row = db.prepare(`
    SELECT u.*
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(hashToken(token), nowIso());

  if (!row) return null;
  if (!row.active) {
    destroySession(token);
    return null;
  }
  return toPublicUser(row);
}

export function destroySession(token) {
  if (!token || typeof token !== 'string') return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function destroyAllSessionsForUser(userId) {
  return db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId).changes;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: config.sessionHours * 3_600_000,
  };
}

export function setSessionCookie(res, token) {
  res.cookie(config.sessionCookieName, token, sessionCookieOptions());
}

export function clearSessionCookie(res) {
  res.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
  });
}

export function requireSessionUser(req) {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function currentSessionToken(req) {
  return req.cookies?.[config.sessionCookieName] || null;
}

export { toPublicUser };
