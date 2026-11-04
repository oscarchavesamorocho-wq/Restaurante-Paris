import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { migrate } from './migrate.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');
db.exec('PRAGMA synchronous = NORMAL');

migrate(db);

export function nowIso() {
  return new Date().toISOString();
}

export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function closeDb() {
  try {
    db.close();
  } catch {
    // La base ya pudo haberse cerrado.
  }
}

const cleanup = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
cleanup.run(nowIso());

export function purgeExpiredSessions() {
  return cleanup.run(nowIso()).changes;
}
