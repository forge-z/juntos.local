import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initDb } from '../server/db.js';
import { buildApp } from '../server/app.js';

const config = {
  nodeEnv: 'test', port: 0, host: '127.0.0.1', origin: 'http://localhost:3000',
  timezone: 'America/Sao_Paulo', trustProxy: false, sessionDays: 30, cookieSecure: false,
  dataDir: mkdtempSync(path.join(tmpdir(), 'juntos-test-')),
  initialPasswords: { alexandre: 'alexandre-senha-123', priscila: 'priscila-senha-123' },
};

let app;
let db;
let cookie;
let priscilaCookie;
let adminId;

test.before(async () => {
  db = await initDb(config);
  app = await buildApp(config, db);

  const alex = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: config.origin }, payload: { username: 'alexandre', password: 'alexandre-senha-123' } });
  assert.equal(alex.statusCode, 200);
  assert.equal(alex.json().must_change_password, true);
  cookie = alex.cookies.find(c => c.name === 'juntos_session').value;
  adminId = alex.json().user.id;

  const pri = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: config.origin }, payload: { username: 'priscila', password: 'priscila-senha-123' } });
  assert.equal(pri.statusCode, 200);
  priscilaCookie = pri.cookies.find(c => c.name === 'juntos_session').value;
});

test.after(() => { db.close(); });

const auth = (extra = {}) => ({ cookie: `juntos_session=${cookie}`, origin: config.origin, ...extra });
const authPri = (extra = {}) => ({ cookie: `juntos_session=${priscilaCookie}`, origin: config.origin, ...extra });

test('healthz responde ok', async () => {
  const res = await app.inject({ method: 'GET', url: '/healthz' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().status, 'ok');
});

test('rota protegida sem sessão responde 401', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/transactions' });
  assert.equal(res.statusCode, 401);
});

test('login com senha errada responde 401', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: config.origin }, payload: { username: 'alexandre', password: 'errada' } });
  assert.equal(res.statusCode, 401);
});

test('mutação por cookie com Origin errada responde 403 (CSRF)', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/v1/transactions', headers: { cookie: `juntos_session=${cookie}`, origin: 'http://evil.example' }, payload: {} });
  assert.equal(res.statusCode, 403);
  assert.equal(res.json().error.code, 'invalid_origin');
});

test('troca de senha invalida as sessões e exige a senha atual', async () => {
  const semAtual = await app.inject({ method: 'PATCH', url: '/api/v1/auth/password', headers: auth(), payload: { password: 'nova-senha-123' } });
  assert.equal(semAtual.statusCode, 400);
  const ok = await app.inject({ method: 'PATCH', url: '/api/v1/auth/password', headers: auth(), payload: { current_password: 'alexandre-senha-123', password: 'nova-senha-123' } });
  assert.equal(ok.statusCode, 200);
  const sessaoAntiga = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: `juntos_session=${cookie}` } });
  assert.equal(sessaoAntiga.statusCode, 401);
  const relogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: config.origin }, payload: { username: 'alexandre', password: 'nova-senha-123' } });
  assert.equal(relogin.statusCode, 200);
  assert.equal(relogin.json().must_change_password, false);
  cookie = relogin.cookies.find(c => c.name === 'juntos_session').value;
});

test('renda atualiza e aparece na lista de membros', async () => {
  const res = await app.inject({ method: 'PATCH', url: `/api/v1/household/members/${adminId}`, headers: auth(), payload: { monthly_income: '6000' } });
  assert.equal(res.statusCode, 200);
  const members = await app.inject({ method: 'GET', url: '/api/v1/household/members', headers: auth() });
  const me = members.json().members.find(m => m.user_id === adminId);
  assert.equal(me.monthly_income, '6000.00');
});

test('CRUD de transações com divisão proporcional', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/v1/transactions', headers: auth(), payload: { description: 'Supermercado', amount: '287.43', category: 'alimentação', division_type: 'proporcional', paid_by: adminId, date: '2026-08-07', payment_method: 'Nubank Alexandre' } });
  assert.equal(res.statusCode, 200);
  const tx = res.json().transaction;
  assert.equal(tx.amount, '287.43');
  assert.equal(tx.split_type, 'proportional');
  assert.equal(tx.payment_method, 'Nubank Alexandre');

  const list = await app.inject({ method: 'GET', url: '/api/v1/transactions', headers: auth() });
  assert.equal(list.json().transactions.length, 1);

  const edit = await app.inject({ method: 'PATCH', url: `/api/v1/transactions/${tx.id}`, headers: auth(), payload: { description: 'Supermercado mensal', amount: '300.00', category: 'alimentação', date: '2026-08-07' } });
  assert.equal(edit.statusCode, 200);
  assert.equal(edit.json().transaction.description, 'Supermercado mensal');

  const del = await app.inject({ method: 'DELETE', url: `/api/v1/transactions/${tx.id}`, headers: auth() });
  assert.equal(del.statusCode, 200);
});

test('CRUD de parcelas simples com pagamento incremental', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/v1/parcelas', headers: auth(), payload: { name: 'Geladeira', total_value: '1200.00', total_installments: 10, paid_installments: 0, due_day: 5, responsible: adminId, split_type: 'proportional', icon: 'casa' } });
  assert.equal(res.statusCode, 200);
  const parcela = res.json().parcela;
  assert.equal(parcela.installment_value, '120.00');
  assert.equal(parcela.type, 'parcelado');

  const pay = await app.inject({ method: 'POST', url: `/api/v1/parcelas/${parcela.id}/pay`, headers: auth() });
  assert.equal(pay.statusCode, 200);
  assert.equal(pay.json().parcela.paid_installments, 1);

  const del = await app.inject({ method: 'DELETE', url: `/api/v1/parcelas/${parcela.id}`, headers: auth() });
  assert.equal(del.statusCode, 200);
});

test('token do agente é exclusivo do admin', async () => {
  const negado = await app.inject({ method: 'POST', url: '/api/v1/admin/api-key', headers: authPri(), payload: {} });
  assert.equal(negado.statusCode, 403);
  const criado = await app.inject({ method: 'POST', url: '/api/v1/admin/api-key', headers: auth(), payload: {} });
  assert.equal(criado.statusCode, 201);
  const token = criado.json().api_key.token;
  assert.match(token, /^jl_live_/);
  const duplicado = await app.inject({ method: 'POST', url: '/api/v1/admin/api-key', headers: auth(), payload: {} });
  assert.equal(duplicado.statusCode, 409);
  // revoga para o teste seguinte criar um token limpo
  await app.inject({ method: 'DELETE', url: '/api/v1/admin/api-key', headers: auth() });
});

let apiToken;

test('agente: contexto, dry-run, criação e idempotência', async () => {
  const criado = await app.inject({ method: 'POST', url: '/api/v1/admin/api-key', headers: auth(), payload: {} });
  apiToken = criado.json().api_key.token;
  const bearer = { authorization: `Bearer ${apiToken}` };

  const semToken = await app.inject({ method: 'GET', url: '/api/v1/agent/context' });
  assert.equal(semToken.statusCode, 401);

  const ctx = await app.inject({ method: 'GET', url: '/api/v1/agent/context', headers: bearer });
  assert.equal(ctx.statusCode, 200);
  assert.deepEqual(ctx.json().members.map(m => m.slug), ['alexandre', 'priscila']);

  const dry = await app.inject({ method: 'POST', url: '/api/v1/agent/expenses', headers: bearer, payload: { description: 'Padaria', amount: '12,50', category: 'alimentação', paid_by: 'priscila', dry_run: true } });
  assert.equal(dry.statusCode, 200);
  assert.equal(dry.json().valid, true);
  assert.equal(dry.json().data.amount, '12.50');
  assert.equal(dry.json().data.paid_by, 'priscila');

  const semChave = await app.inject({ method: 'POST', url: '/api/v1/agent/expenses', headers: bearer, payload: { description: 'Padaria', amount: '12.50' } });
  assert.equal(semChave.statusCode, 422);
  assert.equal(semChave.json().error.code, 'missing_idempotency_key');

  const headers = { ...bearer, 'idempotency-key': 'agente-001' };
  const criada = await app.inject({ method: 'POST', url: '/api/v1/agent/expenses', headers, payload: { description: 'Padaria', amount: '12,50', category: 'alimentação', paid_by: 'priscila' } });
  assert.equal(criada.statusCode, 201);
  assert.equal(criada.json().data.split_type, 'proportional');
  assert.equal(criada.json().idempotent_replay, false);

  const replay = await app.inject({ method: 'POST', url: '/api/v1/agent/expenses', headers, payload: { description: 'Padaria', amount: '12,50', category: 'alimentação', paid_by: 'priscila' } });
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.json().idempotent_replay, true);
  assert.equal(replay.json().data.id, criada.json().data.id);

  const conflito = await app.inject({ method: 'POST', url: '/api/v1/agent/expenses', headers, payload: { description: 'OUTRO', amount: '99.00', category: 'outros' } });
  assert.equal(conflito.statusCode, 409);
  assert.equal(conflito.json().error.code, 'idempotency_conflict');

  const invalida = await app.inject({ method: 'POST', url: '/api/v1/agent/expenses', headers: { ...bearer, 'idempotency-key': 'agente-002' }, payload: { description: 'X', amount: '10', category: 'categoria-inexistente' } });
  assert.equal(invalida.statusCode, 422);
});

test('priscila vê os mesmos dados do lar (mesmo banco, mesmo lar)', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/transactions', headers: authPri() });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().transactions.length >= 1);
  const members = await app.inject({ method: 'GET', url: '/api/v1/household/members', headers: authPri() });
  assert.equal(members.json().members.length, 2);
});

test('token revogado deixa de funcionar imediatamente', async () => {
  await app.inject({ method: 'DELETE', url: '/api/v1/admin/api-key', headers: auth() });
  const res = await app.inject({ method: 'GET', url: '/api/v1/agent/context', headers: { authorization: `Bearer ${apiToken}` } });
  assert.equal(res.statusCode, 401);
});
