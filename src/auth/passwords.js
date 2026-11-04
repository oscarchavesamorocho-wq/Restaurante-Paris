import crypto from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

const ARGON2_OPTIONS = Object.freeze({
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
});

let dummyHashPromise = null;

export async function hashPassword(password) {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash, password) {
  try {
    return await verify(passwordHash, String(password ?? ''));
  } catch {
    return false;
  }
}

export async function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(crypto.randomBytes(32).toString('base64url'));
  }
  return dummyHashPromise;
}

export function generateTemporaryPassword(length = 20) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = crypto.randomBytes(24).toString('base64url').slice(0, length);
    if (/[A-Za-z]/.test(candidate) && /\d/.test(candidate)) return candidate;
  }
  return `Cp-${crypto.randomBytes(16).toString('hex')}`;
}
