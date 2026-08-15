import crypto from 'node:crypto';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
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
  try {
    const [, saltText, hashText] = String(encoded).split('$');
    if (!saltText || !hashText || typeof password !== 'string') return false;
    const derived = await scrypt(password, Buffer.from(saltText, 'base64url'), 64, { N: 16384, r: 8, p: 1 });
    const expected = Buffer.from(hashText, 'base64url');
    return expected.length === derived.length && crypto.timingSafeEqual(expected, Buffer.from(derived));
  } catch { return false; }
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

export function parseNonNegativeMoney(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  if (!(cents >= 0) || cents > 99_999_999_999_999) return null;
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

export function parseDateOrToday(value, timezone) {
  if (value === undefined || value === null || String(value).trim() === '') return todayKey(timezone);
  return parseDate(value, timezone);
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

export const BOOTSTRAP_ADMIN_USERNAME = 'admin';
export const BOOTSTRAP_ADMIN_DISPLAY_NAME = 'Admin';
export const BOOTSTRAP_ADMIN_PASSWORD = 'Admin@123';

const MIGRATIONS = [
  {
    version: 1,
    name: 'installment-payment-ledger',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS installment_payments (
          id TEXT PRIMARY KEY,
          parcela_id TEXT NOT NULL REFERENCES parcelas(id) ON DELETE CASCADE,
          installment_number INTEGER NOT NULL CHECK (installment_number > 0),
          amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
          paid_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          UNIQUE (parcela_id, installment_number)
        );
        CREATE INDEX IF NOT EXISTS installment_payments_date_idx ON installment_payments(paid_at DESC);
      `);
      const backfillPayment = db.prepare(
        'INSERT OR IGNORE INTO installment_payments(id, parcela_id, installment_number, amount_cents, paid_at) VALUES (?, ?, ?, ?, ?)',
      );
      for (const parcela of db.prepare('SELECT * FROM parcelas WHERE paid_installments > 0').all()) {
        const base = Math.floor(parcela.total_value_cents / parcela.total_installments);
        for (let number = 1; number <= parcela.paid_installments; number += 1) {
          const amount = number === parcela.total_installments
            ? parcela.total_value_cents - base * (parcela.total_installments - 1)
            : base;
          backfillPayment.run(crypto.randomUUID(), parcela.id, number, amount, parcela.updated_at || parcela.created_at);
        }
      }
    },
  },
  {
    version: 2,
    name: 'installment-payment-cycle',
    up(db) {
      db.exec(`
        ALTER TABLE installment_payments ADD COLUMN cycle_closing_key TEXT;
        CREATE UNIQUE INDEX installment_payments_cycle_uq
          ON installment_payments(parcela_id, cycle_closing_key)
          WHERE cycle_closing_key IS NOT NULL;
      `);
    },
  },
];

function applyMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  const latest = MIGRATIONS[MIGRATIONS.length - 1]?.version || 0;
  const current = db.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations').get().version;
  if (current > latest) throw new Error(`Database schema ${current} is newer than application schema ${latest}`);
  const applied = db.prepare('SELECT version FROM schema_migrations WHERE version = ?');
  const record = db.prepare('INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)');
  for (const migration of MIGRATIONS) {
    if (applied.get(migration.version)) continue;
    db.exec('BEGIN');
    try {
      migration.up(db);
      record.run(migration.version, migration.name, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

// Seed idempotente: o primeiro boot cria somente um administrador temporário.
// O assistente autenticado troca a senha e cria o segundo usuário antes de liberar o app.
export async function initDb(config) {
  mkdirSync(config.dataDir, { recursive: true });
  chmodSync(config.dataDir, 0o700);
  const dbPath = path.join(config.dataDir, 'juntos.db');
  const db = new DatabaseSync(dbPath);
  chmodSync(dbPath, 0o600);
  for (const sidecar of [`${dbPath}-wal`, `${dbPath}-shm`]) {
    if (existsSync(sidecar)) chmodSync(sidecar, 0o600);
  }
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  applyMigrations(db);

  const count = db.prepare('SELECT count(*) AS n FROM users').get().n;
  const existingAdmin = db.prepare("SELECT username, must_change_password FROM users WHERE role = 'admin' AND active = 1 ORDER BY created_at ASC LIMIT 1").get();
  const insertUser = db.prepare('INSERT OR IGNORE INTO users(id, username, display_name, password_hash, role) VALUES (?, ?, ?, ?, ?)');
  const findUser = db.prepare('SELECT id FROM users WHERE username = ?');
  if (count === 0) {
    insertUser.run(
      crypto.randomUUID(), BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_DISPLAY_NAME,
      await hashPassword(BOOTSTRAP_ADMIN_PASSWORD), 'admin',
    );
  }
  const setMeta = db.prepare('INSERT OR IGNORE INTO meta(key, value) VALUES (?, ?)');
  const needsSetup = count === 0 || (count === 1 && existingAdmin?.username === BOOTSTRAP_ADMIN_USERNAME && existingAdmin.must_change_password === 1);
  setMeta.run('setup_pending', needsSetup ? '1' : '0');
  setMeta.run('household_name', 'Meu lar');
  setMeta.run('closing_day', '5');
  setMeta.run('auto_pay_installments', '0');
  return db;
}
