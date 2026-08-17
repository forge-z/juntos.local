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
  CATEGORIES, SPLIT_TYPES, fmtMoney, parseDateOrToday, parseMoney, parseNonNegativeMoney, todayKey,
} from './db.js';
import { hashPassword, verifyPassword } from './db.js';
import { runAutomaticInstallments, seedAutoPaymentMarker } from './auto-pay.js';

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

function agentTransactionView(row) {
  const view = transactionView(row);
  return {
    ...view,
    paid_by: row.paid_by_manual ? null : (row.paid_by_username || null),
    paid_by_name: row.paid_by_manual || row.paid_by_name || null,
  };
}

function encodeCursor(row) {
  return Buffer.from(JSON.stringify({ date: row.date, created_at: row.created_at, id: row.id })).toString('base64url');
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.date) || !parsed.created_at || !UUID.test(parsed.id)) return null;
    return parsed;
  } catch { return null; }
}

function pagination(request, defaultLimit = 100) {
  const rawLimit = request.query?.limit;
  const limit = rawLimit === undefined ? defaultLimit : Number(rawLimit);
  const cursor = decodeCursor(request.query?.cursor);
  return {
    limit: Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 200) : defaultLimit,
    cursor,
    invalidCursor: Boolean(request.query?.cursor) && !cursor,
  };
}

function pageResult(rows, map, limit) {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    rows: page.map(map),
    pagination: { has_more: hasMore, next_cursor: hasMore ? encodeCursor(page[page.length - 1]) : null },
  };
}

function installmentPaymentView(row) {
  return {
    id: row.id,
    installment_number: row.installment_number,
    amount: fmtMoney(row.amount_cents),
    paid_at: row.paid_at,
    cycle_closing_key: row.cycle_closing_key || null,
    created_at: row.created_at,
  };
}

function parcelaView(row, payments = []) {
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
    paid_value: fmtMoney(payments.reduce((sum, payment) => sum + Number(payment.amount_cents), 0)),
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
  const name = db.prepare("SELECT value FROM meta WHERE key = 'household_name'").get()?.value || 'Meu lar';
  const closing = db.prepare("SELECT value FROM meta WHERE key = 'closing_day'").get()?.value || '5';
  const autoPay = db.prepare("SELECT value FROM meta WHERE key = 'auto_pay_installments'").get()?.value === '1';
  return { name, closing_day: Number(closing), auto_pay_installments: autoPay };
}

function setupPending(db) {
  return db.prepare("SELECT value FROM meta WHERE key = 'setup_pending'").get()?.value === '1';
}

function setupUsername(value, fallback) {
  const normalized = String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  return normalized || fallback;
}

function validUsername(value) {
  return /^[a-z0-9_]{3,32}$/.test(String(value || ''));
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

  // Não há worker separado no modo local: cada requisição faz uma reconciliação
  // idempotente para que o fechamento funcione mesmo após reiniciar o processo.
  app.addHook('onRequest', async () => {
    try {
      runAutomaticInstallments(db, { timezone: config.timezone });
    } catch (error) {
      app.log.error({ err: error }, 'automatic installment payment failed');
    }
  });

  // CSRF: mutações por cookie exigem Origin igual ao configurado; Bearer (agente) passa direto.
  app.addHook('onRequest', async (request, reply) => {
    if (!['POST', 'PATCH', 'DELETE', 'PUT'].includes(request.method) || request.method === 'OPTIONS') return;
    if (request.url.startsWith('/api/v1/agent/') && authenticateApiToken(db, request)) return;
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

  async function requireReadySession(request, reply) {
    await requireSession(request, reply);
    if (reply.sent) return;
    if (setupPending(db)) {
      return sendError(reply, 428, 'setup_required', 'Conclua a configuração inicial antes de continuar');
    }
    if (request.user.must_change_password) {
      return sendError(reply, 428, 'password_change_required', 'Troque a senha inicial antes de continuar');
    }
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
    return {
      user: publicUser(user),
      must_change_password: Boolean(user.must_change_password),
      setup_required: setupPending(db) && user.role === 'admin',
    };
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    destroySession(db, request.cookies.juntos_session);
    reply.clearCookie('juntos_session', { path: '/' });
    return { ok: true };
  });

  app.get('/api/v1/auth/me', async (request, reply) => {
    const user = authenticateSession(db, request.cookies.juntos_session);
    if (!user) return sendError(reply, 401, 'unauthenticated', 'Sessão inválida ou expirada');
    return {
      user: publicUser(user),
      must_change_password: Boolean(user.must_change_password),
      setup_required: setupPending(db) && user.role === 'admin',
    };
  });

  app.get('/api/v1/setup', { preHandler: requireSession }, async (request, reply) => {
    if (!setupPending(db) || request.user.role !== 'admin') {
      return sendError(reply, 404, 'setup_not_required', 'A configuração inicial já foi concluída');
    }
    return {
      setup_pending: true,
      admin: { username: request.user.username, name: request.user.display_name },
    };
  });

  app.post('/api/v1/setup', { preHandler: requireSession }, async (request, reply) => {
    if (!setupPending(db) || request.user.role !== 'admin') {
      return sendError(reply, 404, 'setup_not_required', 'A configuração inicial já foi concluída');
    }
    const body = request.body || {};
    const adminName = String(body.admin_name || '').trim();
    const secondName = String(body.second_name || '').trim();
    const adminUsername = setupUsername(body.admin_username || adminName, 'admin');
    const secondUsername = setupUsername(body.second_username || secondName, 'usuario2');
    const adminPassword = body.admin_password;
    const secondPassword = body.second_password;
    if (adminName.length < 1 || adminName.length > 80 || secondName.length < 1 || secondName.length > 80) {
      return sendError(reply, 422, 'invalid_setup_name', 'Informe nomes entre 1 e 80 caracteres');
    }
    if (!validUsername(adminUsername) || !validUsername(secondUsername) || adminUsername === secondUsername) {
      return sendError(reply, 422, 'invalid_setup_username', 'Os usuários de acesso devem ser diferentes e conter 3 a 32 caracteres válidos');
    }
    if (typeof adminPassword !== 'string' || adminPassword.length < 12 || typeof secondPassword !== 'string' || secondPassword.length < 12) {
      return sendError(reply, 422, 'weak_setup_password', 'As duas senhas devem ter pelo menos 12 caracteres');
    }
    if (adminPassword === 'Admin@123' || secondPassword === 'Admin@123') {
      return sendError(reply, 422, 'default_password_forbidden', 'Escolha senhas diferentes da senha temporária inicial');
    }
    if (adminPassword === secondPassword) {
      return sendError(reply, 422, 'same_setup_password', 'As senhas dos usuários devem ser diferentes');
    }
    const existingAdmin = db.prepare('SELECT * FROM users WHERE id = ? AND role = ? AND active = 1').get(request.user.id, 'admin');
    const activeUsers = db.prepare('SELECT count(*) AS n FROM users WHERE active = 1').get().n;
    if (!existingAdmin || activeUsers !== 1) {
      return sendError(reply, 409, 'setup_state_changed', 'A configuração inicial não está mais disponível');
    }
    const usernameTaken = db.prepare('SELECT id FROM users WHERE username IN (?, ?)').all(adminUsername, secondUsername)
      .some(row => row.id !== request.user.id);
    if (usernameTaken) return sendError(reply, 409, 'username_in_use', 'Um dos usuários de acesso já está em uso');

    const adminHash = await hashPassword(adminPassword);
    const secondHash = await hashPassword(secondPassword);
    const now = new Date().toISOString();
    let transactionOpen = false;
    try {
      db.exec('BEGIN IMMEDIATE');
      transactionOpen = true;
      // Revalida dentro do lock: duas abas não podem concluir o bootstrap em paralelo.
      if (!setupPending(db) || db.prepare('SELECT count(*) AS n FROM users WHERE active = 1').get().n !== 1) {
        db.exec('ROLLBACK');
        transactionOpen = false;
        return sendError(reply, 409, 'setup_state_changed', 'A configuração inicial não está mais disponível');
      }
      const lockedUsername = db.prepare('SELECT id FROM users WHERE username IN (?, ?)').all(adminUsername, secondUsername)
        .some(row => row.id !== request.user.id);
      if (lockedUsername) {
        db.exec('ROLLBACK');
        transactionOpen = false;
        return sendError(reply, 409, 'username_in_use', 'Um dos usuários de acesso já está em uso');
      }
      db.prepare('UPDATE users SET username = ?, display_name = ?, password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?')
        .run(adminUsername, adminName, adminHash, now, request.user.id);
      const secondId = crypto.randomUUID();
      db.prepare('INSERT INTO users(id, username, display_name, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, ?, 1)')
        .run(secondId, secondUsername, secondName, secondHash, 'member');
      const upsert = db.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
      upsert.run('setup_pending', '0');
      upsert.run('household_name', `${adminName} & ${secondName}`);
      db.exec('COMMIT');
      transactionOpen = false;
      // Revoga sessões que poderiam ter sido abertas com a senha temporária e
      // entrega uma sessão nova somente para quem concluiu o assistente.
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(request.user.id);
      const rotated = createSession(db, request.user.id, config.sessionDays, request);
      reply.setCookie('juntos_session', rotated.raw, {
        httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, path: '/', expires: rotated.expires,
      });
      const admin = db.prepare('SELECT * FROM users WHERE id = ?').get(request.user.id);
      const second = db.prepare('SELECT * FROM users WHERE id = ?').get(secondId);
      return { setup_complete: true, admin: publicUser(admin), second_user: publicUser(second) };
    } catch (error) {
      if (transactionOpen) db.exec('ROLLBACK');
      throw error;
    }
  });

  app.patch('/api/v1/auth/password', { preHandler: requireSession }, async (request, reply) => {
    const { current_password: current, password } = request.body || {};
    if (typeof password !== 'string' || password.length < 12) return sendError(reply, 422, 'weak_password', 'A senha precisa ter pelo menos 12 caracteres');
    if (!(await verifyPassword(current || '', request.user.password_hash))) {
      return sendError(reply, 400, 'invalid_current_password', 'Senha atual inválida');
    }
    if (password === current) return sendError(reply, 422, 'same_password', 'A nova senha deve ser diferente da anterior');
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?')
      .run(await hashPassword(password), new Date().toISOString(), request.user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(request.user.id);
    return { ok: true };
  });

  // ── Lar (nome e dia de fechamento em meta; renda direto no usuário) ──────
  app.get('/api/v1/household', { preHandler: requireReadySession }, async () => ({ household: household(db) }));

  app.patch('/api/v1/household', { preHandler: [requireSession, requireAdmin, requireReadySession] }, async (request, reply) => {
    const { name, closing_day, auto_pay_installments } = request.body || {};
    const currentHousehold = household(db);
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 80)) {
      return sendError(reply, 422, 'invalid_name', 'Nome inválido');
    }
    if (closing_day !== undefined && (!Number.isInteger(Number(closing_day)) || Number(closing_day) < -5 || Number(closing_day) > 31)) {
      return sendError(reply, 422, 'invalid_closing_day', 'Dia de fechamento inválido');
    }
    if (auto_pay_installments !== undefined && typeof auto_pay_installments !== 'boolean') {
      return sendError(reply, 422, 'invalid_auto_pay_installments', 'A preferência de pagamento automático é inválida');
    }
    const upsert = db.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    if (name !== undefined) upsert.run('household_name', name.trim());
    if (closing_day !== undefined) upsert.run('closing_day', String(closing_day));
    if (auto_pay_installments !== undefined) {
      upsert.run('auto_pay_installments', auto_pay_installments ? '1' : '0');
    }
    const closingChanged = closing_day !== undefined && Number(closing_day) !== currentHousehold.closing_day;
    const enabling = auto_pay_installments === true && !currentHousehold.auto_pay_installments;
    if ((enabling || (closingChanged && currentHousehold.auto_pay_installments))) {
      const effectiveClosingDay = closing_day === undefined ? currentHousehold.closing_day : Number(closing_day);
      const now = todayKey(config.timezone);
      upsert.run('auto_pay_last_closing', seedAutoPaymentMarker(now, effectiveClosingDay));
    }
    return { household: household(db) };
  });

  app.get('/api/v1/household/members', { preHandler: requireReadySession }, async () => ({
    members: db.prepare('SELECT * FROM users WHERE active = 1 ORDER BY username').all().map(memberView),
  }));

  app.patch('/api/v1/household/members/:userId', { preHandler: requireReadySession }, async (request, reply) => {
    const income = parseNonNegativeMoney(request.body?.monthly_income);
    if (income === null) return sendError(reply, 422, 'invalid_income', 'Renda inválida');
    if (!UUID.test(request.params.userId)) return sendError(reply, 404, 'member_not_found', 'Membro não encontrado');
    if (request.user.role !== 'admin' && request.params.userId !== request.user.id) {
      return sendError(reply, 403, 'admin_required', 'Só o administrador pode alterar a renda de outro usuário');
    }
    const result = db.prepare('UPDATE users SET income_cents = ?, updated_at = ? WHERE id = ?').run(income, new Date().toISOString(), request.params.userId);
    if (!result.changes) return sendError(reply, 404, 'member_not_found', 'Membro não encontrado');
    return { ok: true };
  });

  // ── Transações ───────────────────────────────────────────────────────────
  app.get('/api/v1/transactions', { preHandler: requireReadySession }, async (request, reply) => {
    const page = pagination(request);
    if (page.invalidCursor) return sendError(reply, 422, 'invalid_cursor', 'Cursor inválido');
    const where = [];
    const values = [];
    where.push('(split_type <> ? OR paid_by = ?)');
    values.push('individual', request.user.id);
    if (page.cursor) {
      where.push('(date < ? OR (date = ? AND (created_at < ? OR (created_at = ? AND id < ?))))');
      values.push(page.cursor.date, page.cursor.date, page.cursor.created_at, page.cursor.created_at, page.cursor.id);
    }
    const rows = db.prepare(`SELECT * FROM transactions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY date DESC, created_at DESC, id DESC LIMIT ?`)
      .all(...values, page.limit + 1);
    const result = pageResult(rows, transactionView, page.limit);
    return { transactions: result.rows, pagination: result.pagination };
  });

  app.post('/api/v1/transactions', { preHandler: requireReadySession }, async (request, reply) => {
    const body = request.body || {};
    const description = String(body.description || '').trim();
    const amount = parseMoney(body.amount);
    const date = parseDateOrToday(body.date, config.timezone);
    const split = SPLIT_TYPES.includes(body.split_type) ? body.split_type : 'proportional';
    const category = CATEGORIES.includes(body.category) ? body.category : 'outros';
    if (!description || description.length > 160 || !amount || !date) {
      return sendError(reply, 422, 'invalid_transaction', 'Despesa inválida');
    }
    const payerValue = body.paid_by === undefined ? request.user.id : body.paid_by;
    const payerIsId = UUID.test(String(payerValue));
    const payer = payerIsId
      ? db.prepare('SELECT id FROM users WHERE id = ? AND active = 1').get(String(payerValue))
      : null;
    const payerManual = (payer || payerIsId) ? null : (typeof payerValue === 'string' && payerValue.trim() ? payerValue.trim().slice(0, 160) : null);
    if (!payer && !payerManual) return sendError(reply, 422, 'invalid_payer', 'Pagador inválido');
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO transactions(id, description, amount_cents, category, date, split_type, payment_method, paid_by, paid_by_manual, source, external_id, request_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'web', ?, ?)`,
    ).run(id, description, amount, category, date, split,
      body.payment_method ? String(body.payment_method).slice(0, 100) : null,
      payer?.id || request.user.id,
      payerManual,
      null, null);
    return { transaction: transactionView(db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)) };
  });

  app.patch('/api/v1/transactions/:id', { preHandler: requireReadySession }, async (request, reply) => {
    const body = request.body || {};
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(request.params.id);
    if (!existing) return sendError(reply, 404, 'transaction_not_found', 'Despesa não encontrada');
    if (existing.split_type === 'individual' && existing.paid_by !== request.user.id) {
      return sendError(reply, 404, 'transaction_not_found', 'Despesa não encontrada');
    }
    const description = String(body.description || '').trim();
    const amount = parseMoney(body.amount);
    const date = parseDateOrToday(body.date, config.timezone);
    const split = SPLIT_TYPES.includes(body.split_type) ? body.split_type : 'proportional';
    if (!description || description.length > 160 || !amount || !date || !CATEGORIES.includes(body.category || 'outros') || !SPLIT_TYPES.includes(split)) {
      return sendError(reply, 422, 'invalid_transaction', 'Despesa inválida');
    }
    const payerValue = body.paid_by === undefined ? (existing.paid_by_manual || existing.paid_by) : body.paid_by;
    const payerIsId = UUID.test(String(payerValue));
    const payer = payerIsId
      ? db.prepare('SELECT id FROM users WHERE id = ? AND active = 1').get(String(payerValue))
      : null;
    const payerManual = (payer || payerIsId) ? null : (typeof payerValue === 'string' && payerValue.trim() ? payerValue.trim().slice(0, 160) : null);
    if (!payer && !payerManual) return sendError(reply, 422, 'invalid_payer', 'Pagador inválido');
    const result = db.prepare(
      `UPDATE transactions SET description = ?, amount_cents = ?, category = ?, date = ?, split_type = ?, payment_method = ?, paid_by = ?, paid_by_manual = ?, updated_at = ?
       WHERE id = ?`,
    ).run(description, amount, body.category || 'outros', date, split,
      body.payment_method ? String(body.payment_method).slice(0, 100) : null,
      payer?.id || existing.paid_by, payerManual, new Date().toISOString(), request.params.id);
    if (!result.changes) return sendError(reply, 404, 'transaction_not_found', 'Despesa não encontrada');
    return { transaction: transactionView(db.prepare('SELECT * FROM transactions WHERE id = ?').get(request.params.id)) };
  });

  app.delete('/api/v1/transactions/:id', { preHandler: requireReadySession }, async (request, reply) => {
    const existing = db.prepare('SELECT split_type, paid_by FROM transactions WHERE id = ?').get(request.params.id);
    if (!existing || (existing.split_type === 'individual' && existing.paid_by !== request.user.id)) {
      return sendError(reply, 404, 'transaction_not_found', 'Despesa não encontrada');
    }
    const result = db.prepare('DELETE FROM transactions WHERE id = ?').run(request.params.id);
    if (!result.changes) return sendError(reply, 404, 'transaction_not_found', 'Despesa não encontrada');
    return { ok: true };
  });

  // ── Parcelas simples ─────────────────────────────────────────────────────
  app.get('/api/v1/parcelas', { preHandler: requireReadySession }, async (request) => {
    const rows = db.prepare("SELECT * FROM parcelas WHERE split_type <> 'individual' OR responsible = ? ORDER BY created_at DESC").all(request.user.id);
    const payments = db.prepare('SELECT * FROM installment_payments ORDER BY installment_number ASC').all();
    const byParcela = new Map();
    for (const payment of payments) {
      if (!byParcela.has(payment.parcela_id)) byParcela.set(payment.parcela_id, []);
      byParcela.get(payment.parcela_id).push(payment);
    }
    return {
      parcelas: rows.map(row => {
        const parcelaPayments = byParcela.get(row.id) || [];
        return { ...parcelaView(row, parcelaPayments), payments: parcelaPayments.map(installmentPaymentView) };
      }),
    };
  });

  app.post('/api/v1/parcelas', { preHandler: requireReadySession }, async (request, reply) => {
    const b = request.body || {};
    const total = parseMoney(b.total_value);
    const installments = Number(b.total_installments);
    const paid = Number(b.paid_installments || 0);
    const dueDay = Number(b.due_day || 5);
    const split = SPLIT_TYPES.includes(b.split_type) ? b.split_type : 'proportional';
    if (typeof b.name !== 'string' || !b.name.trim() || b.name.trim().length > 160 || !total || total < installments
      || !Number.isInteger(installments) || installments < 1 || installments > 600
      || !Number.isInteger(paid) || paid < 0 || paid > installments
      || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31 || !SPLIT_TYPES.includes(split)) {
      return sendError(reply, 422, 'invalid_parcela', 'Parcela inválida');
    }
    const responsible = b.responsible && UUID.test(b.responsible) ? b.responsible : request.user.id;
    if (!db.prepare('SELECT id FROM users WHERE id = ? AND active = 1').get(responsible)) {
      return sendError(reply, 422, 'invalid_responsible', 'Responsável inválido');
    }
    const id = crypto.randomUUID();
    db.exec('BEGIN');
    try {
      db.prepare(
        `INSERT INTO parcelas(id, name, total_value_cents, total_installments, paid_installments, due_day, responsible, split_type, icon, category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, b.name.trim(), total, installments, paid, dueDay, responsible, split, b.icon || 'outros', b.category || null);
      const base = Math.floor(total / installments);
      const insertPayment = db.prepare('INSERT INTO installment_payments(id, parcela_id, installment_number, amount_cents, paid_at) VALUES (?, ?, ?, ?, ?)');
      const paidAt = new Date().toISOString();
      for (let number = 1; number <= paid; number += 1) {
        const amountCents = number === installments ? total - base * (installments - 1) : base;
        insertPayment.run(crypto.randomUUID(), id, number, amountCents, paidAt);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const created = db.prepare('SELECT * FROM parcelas WHERE id = ?').get(id);
    const createdPayments = db.prepare('SELECT * FROM installment_payments WHERE parcela_id = ? ORDER BY installment_number ASC').all(id);
    return { parcela: { ...parcelaView(created, createdPayments), payments: createdPayments.map(installmentPaymentView) } };
  });

  app.get('/api/v1/parcelas/:id/payments', { preHandler: requireReadySession }, async (request, reply) => {
    const parcela = db.prepare('SELECT * FROM parcelas WHERE id = ?').get(request.params.id);
    if (!parcela || (parcela.split_type === 'individual' && parcela.responsible !== request.user.id)) {
      return sendError(reply, 404, 'parcela_not_found', 'Parcela não encontrada');
    }
    const payments = db.prepare('SELECT * FROM installment_payments WHERE parcela_id = ? ORDER BY installment_number ASC').all(request.params.id);
    return { parcela: parcelaView(parcela, payments), payments: payments.map(installmentPaymentView) };
  });

  app.post('/api/v1/parcelas/:id/pay', { preHandler: requireReadySession }, async (request, reply) => {
    const parcela = db.prepare('SELECT * FROM parcelas WHERE id = ?').get(request.params.id);
    if (!parcela || (parcela.split_type === 'individual' && parcela.responsible !== request.user.id)) {
      return sendError(reply, 404, 'parcela_not_found', 'Parcela não encontrada');
    }
    if (parcela.paid_installments >= parcela.total_installments) return sendError(reply, 409, 'parcela_already_paid', 'Parcela já foi totalmente paga');
    const installmentNumber = parcela.paid_installments + 1;
    const base = Math.floor(parcela.total_value_cents / parcela.total_installments);
    const amountCents = installmentNumber === parcela.total_installments
      ? parcela.total_value_cents - base * (parcela.total_installments - 1)
      : base;
    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO installment_payments(id, parcela_id, installment_number, amount_cents, paid_at) VALUES (?, ?, ?, ?, ?)')
        .run(crypto.randomUUID(), parcela.id, installmentNumber, amountCents, now);
      db.prepare('UPDATE parcelas SET paid_installments = ?, updated_at = ? WHERE id = ?')
        .run(installmentNumber, now, request.params.id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const updated = db.prepare('SELECT * FROM parcelas WHERE id = ?').get(request.params.id);
    const payments = db.prepare('SELECT * FROM installment_payments WHERE parcela_id = ? ORDER BY installment_number ASC').all(request.params.id);
    return { parcela: { ...parcelaView(updated, payments), payments: payments.map(installmentPaymentView) } };
  });

  app.delete('/api/v1/parcelas/:id/payments/:paymentId', { preHandler: requireReadySession }, async (request, reply) => {
    const parcela = db.prepare('SELECT * FROM parcelas WHERE id = ?').get(request.params.id);
    if (!parcela || (parcela.split_type === 'individual' && parcela.responsible !== request.user.id)) {
      return sendError(reply, 404, 'parcela_not_found', 'Parcela não encontrada');
    }
    const payment = db.prepare('SELECT * FROM installment_payments WHERE id = ? AND parcela_id = ?')
      .get(request.params.paymentId, request.params.id);
    if (!payment) return sendError(reply, 404, 'payment_not_found', 'Pagamento não encontrado');
    if (payment.installment_number !== parcela.paid_installments) {
      return sendError(reply, 409, 'payment_not_last', 'Somente o último pagamento pode ser estornado');
    }
    const now = new Date().toISOString();
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM installment_payments WHERE id = ?').run(payment.id);
      db.prepare('UPDATE parcelas SET paid_installments = ?, updated_at = ? WHERE id = ?')
        .run(parcela.paid_installments - 1, now, parcela.id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const updated = db.prepare('SELECT * FROM parcelas WHERE id = ?').get(parcela.id);
    const payments = db.prepare('SELECT * FROM installment_payments WHERE parcela_id = ? ORDER BY installment_number ASC').all(parcela.id);
    return { parcela: { ...parcelaView(updated, payments), payments: payments.map(installmentPaymentView) }, reversed_payment: installmentPaymentView(payment) };
  });

  app.delete('/api/v1/parcelas/:id', { preHandler: requireReadySession }, async (request, reply) => {
    const parcela = db.prepare('SELECT split_type, responsible FROM parcelas WHERE id = ?').get(request.params.id);
    if (!parcela || (parcela.split_type === 'individual' && parcela.responsible !== request.user.id)) {
      return sendError(reply, 404, 'parcela_not_found', 'Parcela não encontrada');
    }
    const result = db.prepare('DELETE FROM parcelas WHERE id = ?').run(request.params.id);
    if (!result.changes) return sendError(reply, 404, 'parcela_not_found', 'Parcela não encontrada');
    return { ok: true };
  });

  // ── Token único do agente (admin) ────────────────────────────────────────
  app.get('/api/v1/admin/api-key', { preHandler: [requireSession, requireAdmin, requireReadySession] }, async () => ({ api_key: getApiToken(db) }));

  app.post('/api/v1/admin/api-key', { preHandler: [requireSession, requireAdmin, requireReadySession] }, async (request, reply) => {
    if (getApiToken(db)) return sendError(reply, 409, 'api_key_exists', 'Já existe um token ativo. Revogue antes de criar outro.');
    return reply.code(201).send({ api_key: createApiToken(db) });
  });

  app.delete('/api/v1/admin/api-key', { preHandler: [requireSession, requireAdmin, requireReadySession] }, async () => {
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

  app.get('/api/v1/agent/expenses', { preHandler: agentAuth }, async (request, reply) => {
    const month = /^\d{4}-\d{2}$/.test(String(request.query.month || '')) ? request.query.month : null;
    const page = pagination(request, 50);
    if (page.invalidCursor) return sendError(reply, 422, 'invalid_cursor', 'Cursor inválido');
    const where = [];
    const values = [];
    const agentOwner = db.prepare("SELECT id FROM users WHERE role = 'admin' AND active = 1 ORDER BY created_at ASC LIMIT 1").get()?.id;
    if (agentOwner) {
      where.push('(t.split_type <> ? OR t.paid_by = ?)');
      values.push('individual', agentOwner);
    }
    if (month) { where.push('t.date LIKE ?'); values.push(`${month}%`); }
    if (page.cursor) {
      where.push('(t.date < ? OR (t.date = ? AND (t.created_at < ? OR (t.created_at = ? AND t.id < ?))))');
      values.push(page.cursor.date, page.cursor.date, page.cursor.created_at, page.cursor.created_at, page.cursor.id);
    }
    const rows = db.prepare(`SELECT t.*, u.username AS paid_by_username, u.display_name AS paid_by_name FROM transactions t LEFT JOIN users u ON u.id = t.paid_by ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY t.date DESC, t.created_at DESC, t.id DESC LIMIT ?`)
      .all(...values, page.limit + 1);
    const result = pageResult(rows, agentTransactionView, page.limit);
    return { transactions: result.rows, pagination: result.pagination };
  });

  app.post('/api/v1/agent/expenses', { preHandler: agentAuth }, async (request, reply) => {
    const body = request.body || {};
    const description = String(body.description || '').trim();
    const amount = parseMoney(body.amount);
    const date = parseDateOrToday(body.date, config.timezone);
    const category = body.category === undefined ? 'outros' : body.category;
    const split = body.split_type === undefined ? 'proportional' : body.split_type;
    const defaultPayer = db.prepare("SELECT username FROM users WHERE role = 'admin' AND active = 1 ORDER BY created_at ASC LIMIT 1").get()?.username;
    const payerSlug = body.paid_by === undefined ? defaultPayer : body.paid_by;
    const paymentMethod = body.payment_method ? String(body.payment_method).slice(0, 100) : null;

    const invalid = !description || description.length > 160 || !amount || !date
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
    const existing = db.prepare('SELECT t.*, u.username AS paid_by_username, u.display_name AS paid_by_name FROM transactions t LEFT JOIN users u ON u.id = t.paid_by WHERE t.external_id = ?').get(externalId);
    if (existing) {
      if (existing.request_hash !== requestHash) return sendError(reply, 409, 'idempotency_conflict', 'A mesma chave foi usada para outro corpo');
      return reply.code(200).send({ data: agentTransactionView(existing), idempotent_replay: true });
    }

    const id = crypto.randomUUID();
    const inserted = db.prepare(
      `INSERT INTO transactions(id, description, amount_cents, category, date, split_type, payment_method, paid_by, source, external_id, request_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'agent', ?, ?)`,
    ).run(id, description, amount, category, date, split, paymentMethod, payer.id, externalId, requestHash);
    if (!inserted.changes) {
      // corrida: outra requisição ganhou a chave — reavalia como replay
      const winner = db.prepare('SELECT t.*, u.username AS paid_by_username, u.display_name AS paid_by_name FROM transactions t LEFT JOIN users u ON u.id = t.paid_by WHERE t.external_id = ?').get(externalId);
      if (winner.request_hash !== requestHash) return sendError(reply, 409, 'idempotency_conflict', 'A mesma chave foi usada para outro corpo');
      return reply.code(200).send({ data: agentTransactionView(winner), idempotent_replay: true });
    }
    return reply.code(201).send({ data: agentTransactionView(db.prepare('SELECT t.*, u.username AS paid_by_username, u.display_name AS paid_by_name FROM transactions t LEFT JOIN users u ON u.id = t.paid_by WHERE t.id = ?').get(id)), idempotent_replay: false });
  });

  // ── Segurança de resposta ────────────────────────────────────────────────
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    reply.header('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'");
    if (_request.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store');
    // index.html aponta para assets versionados pelo Vite. O shell, porém,
    // precisa ser buscado novamente após um deploy para não prender o
    // navegador em um bundle antigo (e misturar versões da interface).
    if (String(reply.getHeader('content-type') || '').startsWith('text/html')) {
      reply.header('Cache-Control', 'no-store');
    }
    if (config.origin.startsWith('https://')) reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
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
