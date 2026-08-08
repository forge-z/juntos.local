import crypto from 'node:crypto';

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashToken(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: `${row.username}@local`,
    name: row.display_name,
    user_metadata: { name: row.display_name },
    role: row.role,
    must_change_password: Boolean(row.must_change_password),
  };
}

// ── Sessão web (cookie HttpOnly; no banco só o SHA-256 do token) ──────────
export function createSession(db, userId, sessionDays, request) {
  const raw = randomToken(32);
  const expires = new Date(Date.now() + sessionDays * 86400000);
  db.prepare('INSERT INTO sessions(id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(), userId, hashToken(raw), expires.toISOString(),
  );
  return { raw, expires };
}

export function destroySession(db, raw) {
  if (!raw) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(raw));
}

export function authenticateSession(db, raw) {
  if (!raw) return null;
  const row = db.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`,
  ).get(hashToken(raw), new Date().toISOString());
  return row || null;
}

// ── Token único do agente (hash em meta; segredo exibido uma única vez) ───
export function getApiToken(db) {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'api_token_prefix'").get();
  const created = db.prepare("SELECT value FROM meta WHERE key = 'api_token_created_at'").get();
  return row ? { prefix: row.value, created_at: created?.value || null } : null;
}

export function createApiToken(db) {
  const prefix = randomToken(6);
  const secret = randomToken(32);
  const token = `jl_live_${prefix}_${secret}`;
  const now = new Date().toISOString();
  const upsert = db.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  upsert.run('api_token_hash', hashToken(token));
  upsert.run('api_token_prefix', prefix);
  upsert.run('api_token_created_at', now);
  return { token, prefix, created_at: now };
}

export function revokeApiToken(db) {
  const del = db.prepare('DELETE FROM meta WHERE key IN (?, ?, ?)');
  del.run('api_token_hash', 'api_token_prefix', 'api_token_created_at');
}

export function authenticateApiToken(db, request) {
  const header = request.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice(7).trim();
  if (!token.startsWith('jl_live_')) return false;
  const row = db.prepare("SELECT value FROM meta WHERE key = 'api_token_hash'").get();
  return Boolean(row && hashToken(token) === row.value);
}
