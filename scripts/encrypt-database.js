import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import Database from 'better-sqlite3-multiple-ciphers';
import { config } from '../src/config.js';

const dbPath = config.dbPath;
const stagedPath = `${dbPath}.encrypting`;
const backupPath = `${dbPath}.unencrypted-backup`;
const plainHeader = Buffer.from('SQLite format 3\0');

function openEncrypted(filePath) {
  const database = new Database(filePath);
  database.pragma(`key = '${config.dbEncryptionKey}'`);
  database.prepare('SELECT count(*) AS count FROM sqlite_master').get();
  return database;
}

if (!fs.existsSync(dbPath)) {
  console.error(`No existe la base local: ${dbPath}`);
  process.exit(1);
}
if (fs.existsSync(stagedPath) || fs.existsSync(backupPath)) {
  console.error('Ya existe un archivo temporal de conversión. Revísalo antes de continuar.');
  process.exit(1);
}

const header = fs.readFileSync(dbPath).subarray(0, 16);
if (!header.equals(plainHeader)) {
  const check = openEncrypted(dbPath);
  check.close();
  console.log('La base ya está cifrada y se abre correctamente.');
  process.exit(0);
}

let source;
let staged;
try {
  source = new DatabaseSync(dbPath);
  source.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
  source.exec('PRAGMA journal_mode = DELETE');
  source.close();
  source = null;
  fs.copyFileSync(dbPath, stagedPath);

  staged = new Database(stagedPath);
  staged.pragma(`rekey = '${config.dbEncryptionKey}'`);
  staged.close();
  staged = null;

  const check = openEncrypted(stagedPath);
  const integrity = check.pragma('integrity_check', { simple: true });
  check.close();
  if (integrity !== 'ok') throw new Error('La comprobación de integridad de SQLite falló.');

  fs.renameSync(dbPath, backupPath);
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${dbPath}${suffix}`;
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
  }
  fs.renameSync(stagedPath, dbPath);
  fs.unlinkSync(backupPath);
  console.log('Base cifrada y verificada. Los registros existentes se conservaron.');
} catch (error) {
  try { source?.close(); } catch { /* La copia original se conserva para recuperación. */ }
  try { staged?.close(); } catch { /* La copia original se conserva para recuperación. */ }
  console.error(`No se completó la conversión: ${error.message}`);
  if (fs.existsSync(backupPath)) {
    console.error(`Se conservó la copia original sin cifrar en ${path.resolve(backupPath)} para recuperación.`);
  }
  process.exitCode = 1;
}
