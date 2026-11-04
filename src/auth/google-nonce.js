import crypto from 'node:crypto';
import { config } from '../config.js';

const MAX_NONCES = 5;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: config.googleNonceMinutes * 60_000,
  };
}

function clearOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
  };
}

export function readGoogleNonces(req) {
  const raw = req.cookies?.[config.googleNonceCookieName];
  if (typeof raw !== 'string') return [];
  return raw
    .split('.')
    .filter((value) => NONCE_PATTERN.test(value))
    .slice(-MAX_NONCES);
}

export function createGoogleNonce(req, res) {
  const nonce = crypto.randomBytes(32).toString('base64url');
  const nonces = [...readGoogleNonces(req), nonce].slice(-MAX_NONCES);
  res.cookie(config.googleNonceCookieName, nonces.join('.'), cookieOptions());
  return nonce;
}

export function consumeGoogleNonce(req, res, nonce) {
  if (typeof nonce !== 'string' || !NONCE_PATTERN.test(nonce)) return false;
  const nonces = readGoogleNonces(req);
  const index = nonces.indexOf(nonce);
  if (index === -1) return false;

  nonces.splice(index, 1);
  if (nonces.length) {
    res.cookie(config.googleNonceCookieName, nonces.join('.'), cookieOptions());
  } else {
    res.clearCookie(config.googleNonceCookieName, clearOptions());
  }
  return true;
}
