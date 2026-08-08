import crypto from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';

const scrypt = promisify(crypto.scrypt);

// ── Senhas (scrypt com salt individual) ────────────────────────────────────
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8) throw new Error('Passwords must have at least 8 characters');
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  const [, saltText, hashText] = String(encoded).split('$');
  if (!saltText || !hashText) return false;
  const derived = await scrypt(password, Buffer.from(saltText, 'base64url'), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(Buffer.from(hashText, 'base64url'), Buffer.from(derived));
}

// ── Dinheiro: sempre inteiro em centavos, nunca float ─────────────────────
// ponytail: centavos em INTEGER; a borda da API converte string decimal.
export function parseMoney(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  if (!(cents > 0) || cents > 99_999_999_999_999) return null;
  return cents;
}

export function fmtMoney(cents) {
  return (Number(cents) / 100).toFixed(2);
}

// ── Datas ──────────────────────────────────────────────────────────────────
export function todayKey(timezone) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date());
}

export function parseDate(value, timezone) {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T12:00:00Z`);
  const roundtrip = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  return roundtrip === text ? text : null;
}

// ── Transação SQL ──────────────────────────────────────────────────────────
export function withTransaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn(db);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export const CATEGORIES = ['alimentação', 'moradia', 'transporte', 'saúde', 'lazer', 'educação', 'assinaturas', 'vestuário', 'outros'];
export const SPLIT_TYPES = ['equal', 'proportional', 'individual'];

// ── Schema ─────────────────────────────────────────────────────────────────
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE CHECK (length(username) BETWEEN 3 AND 32),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  income_cents INTEGER NOT NULL DEFAULT 0 CHECK (income_cents >= 0),
  must_change_password INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 160),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category TEXT NOT NULL DEFAULT 'outros',
  date TEXT NOT NULL,
  split_type TEXT NOT NULL DEFAULT 'proportional' CHECK (split_type IN ('proportional','equal','individual')),
  payment_method TEXT,
  paid_by TEXT NOT NULL REFERENCES users(id),
  paid_by_manual TEXT,
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web','agent')),
  external_id TEXT,
  request_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_external_id_uq ON transactions(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(date DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS parcelas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  total_value_cents INTEGER NOT NULL CHECK (total_value_cents > 0),
  total_installments INTEGER NOT NULL CHECK (total_installments > 0),
  paid_installments INTEGER NOT NULL DEFAULT 0 CHECK (paid_installments >= 0),
  due_day INTEGER NOT NULL DEFAULT 5 CHECK (due_day BETWEEN 1 AND 31),
  responsible TEXT NOT NULL REFERENCES users(id),
  split_type TEXT NOT NULL DEFAULT 'proportional' CHECK (split_type IN ('proportional','equal','individual')),
  icon TEXT NOT NULL DEFAULT 'outros',
  category TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (paid_installments <= total_installments)
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// Seed idempotente: cria Alexandre/Priscila, o lar e as configurações iniciais.
// Nunca há senha padrão no código — sem as duas variáveis o primeiro boot falha.
export async function initDb(config) {
  mkdirSync(config.dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(config.dataDir, 'juntos.db'));
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  const count = db.prepare('SELECT count(*) AS n FROM users').get().n;
  if (count === 0 && (!config.initialPasswords.alexandre || !config.initialPasswords.priscila)) {
    throw new Error('ALEXANDRE_INITIAL_PASSWORD and PRISCILA_INITIAL_PASSWORD are required for the first boot');
  }
  const insertUser = db.prepare('INSERT OR IGNORE INTO users(id, username, display_name, password_hash, role) VALUES (?, ?, ?, ?, ?)');
  const findUser = db.prepare('SELECT id FROM users WHERE username = ?');
  for (const user of [
    { username: 'alexandre', displayName: 'Alexandre', role: 'admin', password: config.initialPasswords.alexandre },
    { username: 'priscila', displayName: 'Priscila', role: 'member', password: config.initialPasswords.priscila },
  ]) {
    if (!findUser.get(user.username)) {
      insertUser.run(crypto.randomUUID(), user.username, user.displayName, await hashPassword(user.password), user.role);
    }
  }
  const setMeta = db.prepare('INSERT OR IGNORE INTO meta(key, value) VALUES (?, ?)');
  setMeta.run('household_name', 'Alexandre & Priscila');
  setMeta.run('closing_day', '5');
  return db;
}
