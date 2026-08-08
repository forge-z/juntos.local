import path from 'node:path';
import { existsSync } from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import {
  authenticateApiToken, authenticateSession, createApiToken, createSession,
  destroySession, getApiToken, publicUser, revokeApiToken,
} from './security.js';
import {
  CATEGORIES, SPLIT_TYPES, fmtMoney, parseDate, parseMoney, todayKey,
} from './db.js';
import { hashPassword, verifyPassword } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendError(reply, status, code, message, fields) {
  return reply.code(status).send({ error: { code, message, ...(fields ? { fields } : {}) }, request_id: reply.request.id });
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function memberView(row) {
  return {
    id: row.id,
    user_id: row.id,
    name: row.display_name,
    email: `${row.username}@local`,
    username: row.username,
    // número, não string: o dashboard soma as rendas dos dois para calcular
    // a divisão proporcional (string "6000.00" + "3000.00" viraria concatenação)
    monthly_income: Number(row.income_cents) / 100,
    role: row.role,
    is_manual: false,
  };
}

function transactionView(row) {
  return {
    id: row.id,
    description: row.description,
    amount: fmtMoney(row.amount_cents),
    category: row.category,
    date: row.date,
    split_type: row.split_type,
    payment_method: row.payment_method || null,
    paid_by: row.paid_by,
    paid_by_manual: row.paid_by_manual,
    source: row.source,
    created_at: row.created_at,
  };
}

function parcelaView(row) {
  return {
    id: row.id,
    name: row.name,
    type: 'parcelado',
    total_value: fmtMoney(row.total_value_cents),
    down_payment: '0.00',
    financed_value: fmtMoney(row.total_value_cents),
    installment_value: (row.total_value_cents / row.total_installments / 100).toFixed(2),
    annual_rate: '0',
    total_installments: row.total_installments,
    paid_installments: row.paid_installments,
    due_day: row.due_day,
    responsible: row.responsible,
    split_type: row.split_type,
    icon: row.icon,
    category: row.category,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function household(db) {
  const name = db.prepare("SELECT value FROM meta WHERE key = 'household_name'").get()?.value || 'Alexandre & Priscila';
  const closing = db.prepare("SELECT value FROM meta WHERE key = 'closing_day'").get()?.value || '5';
  return { name, closing_day: Number(closing) };
}

export async function buildApp(config, db) {
  const app = (await import('fastify')).default({
    logger: config.nodeEnv !== 'test',
    trustProxy: config.trustProxy,
    bodyLimit: 128 * 1024,
    requestIdHeader: 'x-request-id',
  });

  await app.register(fastifyCookie);
  await app.register(fastifyCors, { origin: config.origin, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] });
  await app.register(fastifyRateLimit, { max: 120, timeWindow: '1 minute', skipOnError: true });

  // CSRF: mutações por cookie exigem Origin igual ao configurado; Bearer (agente) passa direto.
  app.addHook('onRequest', async (request, reply) => {
    if (!['POST', 'PATCH', 'DELETE', 'PUT'].includes(request.method) || request.method === 'OPTIONS') return;
    if (String(request.headers.authorization || '').startsWith('Bearer ')) return;
    if (request.headers.origin !== config.origin) return sendError(reply, 403, 'invalid_origin', 'Origem não permitida');
  });

  // ── preHandlers (capturam `db`) ──────────────────────────────────────────
  async function requireSession(request, reply) {
    const user = authenticateSession(db, request.cookies.juntos_session);
    if (!user) return sendError(reply, 401, 'unauthenticated', 'Sessão inválida ou expirada');
    request.user = user;
  }

  async function requireAdmin(request, reply) {
    if (request.user?.role !== 'admin') return sendError(reply, 403, 'admin_required', 'Acesso administrativo necessário');
  }

  async function agentAuth(request, reply) {
    if (!authenticateApiToken(db, request)) {
      return sendError(reply, 401, 'invalid_api_key', 'API key inválida ou revogada');
    }
  }

  app.get('/healthz', async () => {
    db.prepare('SELECT 1').get();
    return { status: 'ok' };
  });

  // ── Autenticação web ─────────────────────────────────────────────────────
  app.post('/api/v1/auth/login', { config: { rateLimit: { max: 8, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const { username, password } = request.body || {};
    if (!/^[a-z0-9_]{3,32}$/.test(String(username || '')) || typeof password !== 'string') {
      return sendError(reply, 422, 'invalid_payload', 'Usuário e senha são obrigatórios');
    }
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return sendError(reply, 401, 'invalid_credentials', 'Usuário ou senha inválidos');
    }
    const session = createSession(db, user.id, config.sessionDays, request);
    reply.setCookie('juntos_session', session.raw, {
      httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, path: '/', expires: session.expires,
    });
    return { user: publicUser(user), must_change_password: Boolean(user.must_change_password) };
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    destroySession(db, request.cookies.juntos_session);
    reply.clearCookie('juntos_session', { path: '/' });
    return { ok: true };
  });

  app.get('/api/v1/auth/me', async (request, reply) => {
    const user = authenticateSession(db, request.cookies.juntos_session);
    if (!user) return sendError(reply, 401, 'unauthenticated', 'Sessão inválida ou expirada');
    return { user: publicUser(user), must_change_password: Boolean(user.must_change_password) };
  });

  app.patch('/api/v1/auth/password', { preHandler: requireSession }, async (request, reply) => {
    const { current_password: current, password } = request.body || {};
    if (typeof password !== 'string' || password.length < 8) return sendError(reply, 422, 'weak_password', 'A senha precisa ter pelo menos 8 caracteres');
    if (!(await verifyPassword(current || '', request.user.password_hash))) {
      return sendError(reply, 400, 'invalid_current_password', 'Senha atual inválida');
    }
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?')
      .run(await hashPassword(password), new Date().toISOString(), request.user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(request.user.id);
    return { ok: true };
  });

  // ── Lar (nome e dia de fechamento em meta; renda direto no usuário) ──────
  app.get('/api/v1/household', { preHandler: requireSession }, async () => ({ household: household(db) }));

  app.patch('/api/v1/household', { preHandler: requireSession }, async (request, reply) => {
    const { name, closing_day } = request.body || {};
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 80)) {
      return sendError(reply, 422, 'invalid_name', 'Nome inválido');
    }
    if (closing_day !== undefined && (!Number.isInteger(Number(closing_day)) || Number(closing_day) < -5 || Number(closing_day) > 31)) {
      return sendError(reply, 422, 'invalid_closing_day', 'Dia de fechamento inválido');
    }
    const upsert = db.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    if (name !== undefined) upsert.run('household_name', name.trim());
    if (closing_day !== undefined) upsert.run('closing_day', String(closing_day));
    return { household: household(db) };
  });

  app.get('/api/v1/household/members', { preHandler: requireSession }, async () => ({
    members: db.prepare('SELECT * FROM users WHERE active = 1 ORDER BY username').all().map(memberView),
  }));

  app.patch('/api/v1/household/members/:userId', { preHandler: requireSession }, async (request, reply) => {
    const income = parseMoney(request.body?.monthly_income);
    if (!income) return sendError(reply, 422, 'invalid_income', 'Renda inválida');
    if (!UUID.test(request.params.userId)) return sendError(reply, 404, 'member_not_found', 'Membro não encontrado');
    const result = db.prepare('UPDATE users SET income_cents = ?, updated_at = ? WHERE id = ?').run(income, new Date().toISOString(), request.params.userId);
    if (!result.changes) return sendError(reply, 404, 'member_not_found', 'Membro não encontrado');
    return { ok: true };
  });

  // ── Transações ───────────────────────────────────────────────────────────
  app.get('/api/v1/transactions', { preHandler: requireSession }, async () => ({
    transactions: db.prepare('SELECT * FROM transactions ORDER BY date DESC, created_at DESC').all().map(transactionView),
  }));

  app.post('/api/v1/transactions', { preHandler: requireSession }, async (request, reply) => {
    const body = request.body || {};
    const description = String(body.description || '').trim();
    const amount = parseMoney(body.amount);
    const date = parseDate(body.date, config.timezone) || todayKey(config.timezone);
    const split = SPLIT_TYPES.includes(body.split_type) ? body.split_type : 'proportional';
    const category = CATEGORIES.includes(body.category) ? body.category : 'outros';
    if (!description || description.length > 160 || !amount) {
      return sendError(reply, 422, 'invalid_transaction', 'Despesa inválida');
    }
    const payer = body.paid_by && UUID.test(body.paid_by)
      ? db.prepare('SELECT id FROM users WHERE id = ? AND active = 1').get(body.paid_by)
      : null;
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO transactions(id, description, amount_cents, category, date, split_type, payment_method, paid_by, paid_by_manual, source, external_id, request_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'web', ?, ?)`,
    ).run(id, description, amount, category, date, split,
      body.payment_method ? String(body.payment_method).slice(0, 100) : null,
      payer?.id || request.user.id,
      body.paid_by && !payer ? String(body.paid_by).slice(0, 160) : null,
      body.external_id || null, body.request_hash || null);
    return { transaction: transactionView(db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)) };
  });

  app.patch('/api/v1/transactions/:id', { preHandler: requireSession }, async (request, reply) => {
    const body = request.body || {};
    const description = String(body.description || '').trim();
    const amount = parseMoney(body.amount);
    const date = parseDate(body.date, config.timezone);
    const split = SPLIT_TYPES.includes(body.split_type) ? body.split_type : 'proportional';
    if (!description || description.length > 160 || !amount || !date || !CATEGORIES.includes(body.category || 'outros') || !SPLIT_TYPES.includes(split)) {
      return sendError(reply, 422, 'invalid_transaction', 'Despesa inválida');
    }
    const result = db.prepare(
      `UPDATE transactions SET description = ?, amount_cents = ?, category = ?, date = ?, split_type = ?, payment_method = ?, paid_by = ?, paid_by_manual = ?, updated_at = ?
       WHERE id = ?`,
    ).run(description, amount, body.category || 'outros', date, split,
      body.payment_method ? String(body.payment_method).slice(0, 100) : null,
      request.user.id, null, new Date().toISOString(), request.params.id);
    if (!result.changes) return sendError(reply, 404, 'transaction_not_found', 'Despesa não encontrada');
    return { transaction: transactionView(db.prepare('SELECT * FROM transactions WHERE id = ?').get(request.params.id)) };
  });

  app.delete('/api/v1/transactions/:id', { preHandler: requireSession }, async (request, reply) => {
    const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(request.params.id);
    if (!result.changes) return sendError(reply, 404, 'transaction_not_found', 'Despesa não encontrada');
    return { ok: true };
  });

  // ── Parcelas simples ─────────────────────────────────────────────────────
  app.get('/api/v1/parcelas', { preHandler: requireSession }, async () => ({
    parcelas: db.prepare('SELECT * FROM parcelas ORDER BY created_at DESC').all().map(parcelaView),
  }));

  app.post('/api/v1/parcelas', { preHandler: requireSession }, async (request, reply) => {
    const b = request.body || {};
    const total = parseMoney(b.total_value);
    const installments = Number(b.total_installments);
    const paid = Number(b.paid_installments || 0);
    const dueDay = Number(b.due_day || 5);
    const split = SPLIT_TYPES.includes(b.split_type) ? b.split_type : 'proportional';
    if (typeof b.name !== 'string' || !b.name.trim() || b.name.trim().length > 160 || !total
      || !Number.isInteger(installments) || installments < 1 || installments > 600
      || !Number.isInteger(paid) || paid < 0 || paid > installments
      || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31 || !SPLIT_TYPES.includes(split)) {
      return sendError(reply, 422, 'invalid_parcela', 'Parcela inválida');
    }
    const responsible = b.responsible && UUID.test(b.responsible) ? b.responsible : request.user.id;
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO parcelas(id, name, total_value_cents, total_installments, paid_installments, due_day, responsible, split_type, icon, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, b.name.trim(), total, installments, paid, dueDay, responsible, split, b.icon || 'outros', b.category || null);
    return { parcela: parcelaView(db.prepare('SELECT * FROM parcelas WHERE id = ?').get(id)) };
  });

  app.post('/api/v1/parcelas/:id/pay', { preHandler: requireSession }, async (request, reply) => {
    const result = db.prepare('UPDATE parcelas SET paid_installments = MIN(paid_installments + 1, total_installments), updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), request.params.id);
    if (!result.changes) return sendError(reply, 404, 'parcela_not_found', 'Parcela não encontrada');
    return { parcela: parcelaView(db.prepare('SELECT * FROM parcelas WHERE id = ?').get(request.params.id)) };
  });

  app.delete('/api/v1/parcelas/:id', { preHandler: requireSession }, async (request, reply) => {
    const result = db.prepare('DELETE FROM parcelas WHERE id = ?').run(request.params.id);
    if (!result.changes) return sendError(reply, 404, 'parcela_not_found', 'Parcela não encontrada');
    return { ok: true };
  });

  // ── Token único do agente (admin) ────────────────────────────────────────
  app.get('/api/v1/admin/api-key', { preHandler: [requireSession, requireAdmin] }, async () => ({ api_key: getApiToken(db) }));

  app.post('/api/v1/admin/api-key', { preHandler: [requireSession, requireAdmin] }, async (request, reply) => {
    if (getApiToken(db)) return sendError(reply, 409, 'api_key_exists', 'Já existe um token ativo. Revogue antes de criar outro.');
    return reply.code(201).send({ api_key: createApiToken(db) });
  });

  app.delete('/api/v1/admin/api-key', { preHandler: [requireSession, requireAdmin] }, async () => {
    revokeApiToken(db);
    return { ok: true };
  });

  // ── API do agente (Bearer + Idempotency-Key) ─────────────────────────────
  app.get('/api/v1/agent/context', { preHandler: agentAuth }, async () => ({
    timezone: config.timezone,
    currency: 'BRL',
    today: todayKey(config.timezone),
    members: db.prepare('SELECT username AS slug, display_name AS name FROM users WHERE active = 1 ORDER BY username').all(),
    categories: CATEGORIES,
    split_types: SPLIT_TYPES,
    payment_method: 'texto livre — informe o nome do cartão/conta se quiser, ou omita',
  }));

  app.get('/api/v1/agent/expenses', { preHandler: agentAuth }, async (request) => {
    const month = /^\d{4}-\d{2}$/.test(String(request.query.month || '')) ? request.query.month : null;
    const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 200);
    const rows = month
      ? db.prepare('SELECT * FROM transactions WHERE date LIKE ? ORDER BY date DESC, created_at DESC LIMIT ?').all(`${month}%`, limit)
      : db.prepare('SELECT * FROM transactions ORDER BY date DESC, created_at DESC LIMIT ?').all(limit);
    return { transactions: rows.map(transactionView) };
  });

  app.post('/api/v1/agent/expenses', { preHandler: agentAuth }, async (request, reply) => {
    const body = request.body || {};
    const description = String(body.description || '').trim();
    const amount = parseMoney(body.amount);
    const date = parseDate(body.date, config.timezone) || todayKey(config.timezone);
    const category = body.category === undefined ? 'outros' : body.category;
    const split = body.split_type === undefined ? 'proportional' : body.split_type;
    const payerSlug = body.paid_by === undefined ? 'alexandre' : body.paid_by;
    const paymentMethod = body.payment_method ? String(body.payment_method).slice(0, 100) : null;

    const invalid = !description || description.length > 160 || !amount
      || !CATEGORIES.includes(category) || !SPLIT_TYPES.includes(split);
    const payer = db.prepare('SELECT id FROM users WHERE username = ? AND active = 1').get(payerSlug);
    if (invalid || !payer) {
      return sendError(reply, 422, 'invalid_payload', 'Payload de despesa inválido. Consulte /agent/context para valores aceitos.');
    }

    const normalized = { description, amount: fmtMoney(amount), date, category, split_type: split, paid_by: payerSlug, payment_method: paymentMethod };

    if (body.dry_run === true) {
      return { valid: true, data: { ...normalized, source: 'agent' }, idempotent_replay: false };
    }

    const idem = String(request.headers['idempotency-key'] || '').trim();
    if (!idem || idem.length > 128) return sendError(reply, 422, 'missing_idempotency_key', 'Idempotency-Key é obrigatória');
    const requestHash = crypto.createHash('sha256').update(stableStringify(normalized)).digest('hex');
    const externalId = `agent:${idem}`;

    // Replay: mesma chave → mesmo corpo = 200 com o registro original; corpo diferente = 409.
    const existing = db.prepare('SELECT * FROM transactions WHERE external_id = ?').get(externalId);
    if (existing) {
      if (existing.request_hash !== requestHash) return sendError(reply, 409, 'idempotency_conflict', 'A mesma chave foi usada para outro corpo');
      return reply.code(200).send({ data: transactionView(existing), idempotent_replay: true });
    }

    const id = crypto.randomUUID();
    const inserted = db.prepare(
      `INSERT INTO transactions(id, description, amount_cents, category, date, split_type, payment_method, paid_by, source, external_id, request_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'agent', ?, ?)`,
    ).run(id, description, amount, category, date, split, paymentMethod, payer.id, externalId, requestHash);
    if (!inserted.changes) {
      // corrida: outra requisição ganhou a chave — reavalia como replay
      const winner = db.prepare('SELECT * FROM transactions WHERE external_id = ?').get(externalId);
      if (winner.request_hash !== requestHash) return sendError(reply, 409, 'idempotency_conflict', 'A mesma chave foi usada para outro corpo');
      return reply.code(200).send({ data: transactionView(winner), idempotent_replay: true });
    }
    return reply.code(201).send({ data: transactionView(db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)), idempotent_replay: false });
  });

  // ── Segurança de resposta ────────────────────────────────────────────────
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'");
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    if (error.message === 'idempotency_conflict') return sendError(reply, 409, 'idempotency_conflict', 'A mesma chave foi usada para outro corpo');
    if (String(error.message).includes('UNIQUE constraint failed')) return sendError(reply, 422, 'invalid_payload', 'Payload inválido');
    return sendError(reply, error.statusCode || 500, error.statusCode ? 'request_failed' : 'internal_error', error.statusCode ? error.message : 'Erro interno');
  });

  const dist = path.resolve(__dirname, '../dist');
  if (existsSync(dist)) await app.register(fastifyStatic, { root: dist, prefix: '/' });
  app.setNotFoundHandler((request, reply) => {
    if (request.method === 'GET' && !request.url.startsWith('/api/')) return reply.sendFile('index.html');
    return sendError(reply, 404, 'not_found', 'Rota não encontrada');
  });

  return app;
}
