import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { initDb } from '../server/db.js';
import { buildApp } from '../server/app.js';
import { runAutomaticInstallments, seedAutoPaymentMarker } from '../server/auto-pay.js';
import { todayKey } from '../server/db.js';

const config = {
  nodeEnv: 'test', port: 0, host: '127.0.0.1', origin: 'http://localhost:3000',
  timezone: 'America/Sao_Paulo', trustProxy: false, sessionDays: 30, cookieSecure: false,
  dataDir: mkdtempSync(path.join(tmpdir(), 'juntos-test-')),
};

let app;
let db;
let cookie;
let priscilaCookie;
let adminId;

test.before(async () => {
  db = await initDb(config);
  app = await buildApp(config, db);
  assert.equal(db.prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1').get().version, 2);

  const alex = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: config.origin }, payload: { username: 'alexandre', password: 'alexandre-senha-123' } });
  assert.equal(alex.statusCode, 401);
  const admin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: config.origin }, payload: { username: 'admin', password: 'Admin@123' } });
  assert.equal(admin.statusCode, 200);
  assert.equal(admin.json().must_change_password, true);
  assert.equal(admin.json().setup_required, true);
  cookie = admin.cookies.find(c => c.name === 'juntos_session').value;
  adminId = admin.json().user.id;
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

test('Bearer inválido não contorna CSRF em rota web', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/v1/transactions', headers: { cookie: `juntos_session=${cookie}`, origin: 'http://evil.example', authorization: 'Bearer inválido' }, payload: { description: 'não deve gravar', amount: '1.00' } });
  assert.equal(res.statusCode, 403);
});

test('primeiro boot exige configuração e cria o segundo usuário', async () => {
  const status = await app.inject({ method: 'GET', url: '/api/v1/setup', headers: auth() });
  assert.equal(status.statusCode, 200);
  assert.equal(status.json().setup_pending, true);
  const bloqueado = await app.inject({ method: 'PATCH', url: '/api/v1/household', headers: auth(), payload: { name: 'não permitido' } });
  assert.equal(bloqueado.statusCode, 428);
  const preSetupPassword = await app.inject({ method: 'PATCH', url: '/api/v1/auth/password', headers: auth(), payload: { current_password: 'Admin@123', password: 'admin-pre-setup-123' } });
  assert.equal(preSetupPassword.statusCode, 200);
  const preSetupLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: config.origin }, payload: { username: 'admin', password: 'admin-pre-setup-123' } });
  cookie = preSetupLogin.cookies.find(c => c.name === 'juntos_session').value;
  const tokenBeforeSetup = await app.inject({ method: 'POST', url: '/api/v1/admin/api-key', headers: auth(), payload: {} });
  assert.equal(tokenBeforeSetup.statusCode, 428);
  const staleLogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: config.origin }, payload: { username: 'admin', password: 'admin-pre-setup-123' } });
  const staleCookie = staleLogin.cookies.find(c => c.name === 'juntos_session').value;

  const setup = await app.inject({
    method: 'POST', url: '/api/v1/setup', headers: auth(),
    payload: {
      admin_name: 'Alexandre', admin_username: 'alexandre', admin_password: 'admin-definitiva-123',
      second_name: 'Priscila', second_username: 'priscila', second_password: 'priscila-temporaria-123',
    },
  });
  assert.equal(setup.statusCode, 200);
  assert.equal(setup.json().admin.must_change_password, false);
  assert.equal(setup.json().second_user.must_change_password, true);
  cookie = setup.cookies.find(c => c.name === 'juntos_session').value;
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: `juntos_session=${staleCookie}` } })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/setup', headers: auth() })).statusCode, 404);

  const pri = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: config.origin }, payload: { username: 'priscila', password: 'priscila-temporaria-123' } });
  assert.equal(pri.statusCode, 200);
  assert.equal(pri.json().must_change_password, true);
  assert.equal(pri.json().setup_required, false);
  priscilaCookie = pri.cookies.find(c => c.name === 'juntos_session').value;
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/transactions', headers: authPri() })).statusCode, 428);
  assert.equal((await app.inject({ method: 'GET', url: '/api/v1/parcelas', headers: authPri() })).statusCode, 428);
  const priHousehold = await app.inject({ method: 'PATCH', url: '/api/v1/household', headers: authPri(), payload: { name: 'bloqueado' } });
  assert.equal(priHousehold.statusCode, 403);
  const priPassword = await app.inject({ method: 'PATCH', url: '/api/v1/auth/password', headers: authPri(), payload: { current_password: 'priscila-temporaria-123', password: 'priscila-definitiva-123' } });
  assert.equal(priPassword.statusCode, 200);
  const priRelogin = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: config.origin }, payload: { username: 'priscila', password: 'priscila-definitiva-123' } });
  priscilaCookie = priRelogin.cookies.find(c => c.name === 'juntos_session').value;
});

test('troca de senha invalida as sessões e exige a senha atual', async () => {
  const semAtual = await app.inject({ method: 'PATCH', url: '/api/v1/auth/password', headers: auth(), payload: { password: 'nova-senha-123' } });
  assert.equal(semAtual.statusCode, 400);
  const ok = await app.inject({ method: 'PATCH', url: '/api/v1/auth/password', headers: auth(), payload: { current_password: 'admin-definitiva-123', password: 'nova-senha-123' } });
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
  assert.equal(me.monthly_income, 6000);
  assert.equal(typeof me.monthly_income, 'number');
});

test('configuração do lar controla o pagamento automático', async () => {
  const initial = await app.inject({ method: 'GET', url: '/api/v1/household', headers: auth() });
  assert.equal(initial.statusCode, 200);
  assert.equal(initial.json().household.auto_pay_installments, false);
  const invalid = await app.inject({ method: 'PATCH', url: '/api/v1/household', headers: auth(), payload: { auto_pay_installments: 'yes' } });
  assert.equal(invalid.statusCode, 422);
  const enabled = await app.inject({ method: 'PATCH', url: '/api/v1/household', headers: auth(), payload: { auto_pay_installments: true } });
  assert.equal(enabled.statusCode, 200);
  assert.equal(enabled.json().household.auto_pay_installments, true);
  const disabled = await app.inject({ method: 'PATCH', url: '/api/v1/household', headers: auth(), payload: { auto_pay_installments: false } });
  assert.equal(disabled.statusCode, 200);
  assert.equal(disabled.json().household.auto_pay_installments, false);
});

test('segundo usuário configurado não pode reabrir o assistente', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/v1/setup', headers: authPri() });
  assert.equal(res.statusCode, 404);
});

test('membro não altera configurações do lar nem a renda do administrador', async () => {
  const householdEdit = await app.inject({ method: 'PATCH', url: '/api/v1/household', headers: authPri(), payload: { closing_day: 31 } });
  assert.equal(householdEdit.statusCode, 403);
  const incomeEdit = await app.inject({ method: 'PATCH', url: `/api/v1/household/members/${adminId}`, headers: authPri(), payload: { monthly_income: '99999' } });
  assert.equal(incomeEdit.statusCode, 403);
});

test('renda zero é aceita como valor válido', async () => {
  const res = await app.inject({ method: 'PATCH', url: `/api/v1/household/members/${adminId}`, headers: auth(), payload: { monthly_income: '0' } });
  assert.equal(res.statusCode, 200);
  const members = await app.inject({ method: 'GET', url: '/api/v1/household/members', headers: auth() });
  assert.equal(members.json().members.find(m => m.user_id === adminId).monthly_income, 0);
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

test('data inválida não cai silenciosamente em hoje e pagador é preservado na edição', async () => {
  const invalid = await app.inject({ method: 'POST', url: '/api/v1/transactions', headers: auth(), payload: { description: 'Data inválida', amount: '1.00', date: '2026-99-99' } });
  assert.equal(invalid.statusCode, 422);
  const created = await app.inject({ method: 'POST', url: '/api/v1/transactions', headers: auth(), payload: { description: 'Pago por Priscila', amount: '10.00', paid_by: (await app.inject({ method: 'GET', url: '/api/v1/household/members', headers: auth() })).json().members.find(m => m.username === 'priscila').user_id, date: '2026-08-07' } });
  const tx = created.json().transaction;
  const edited = await app.inject({ method: 'PATCH', url: `/api/v1/transactions/${tx.id}`, headers: auth(), payload: { description: 'Editada', amount: '10.00', category: 'outros', split_type: 'equal', date: '2026-08-07' } });
  assert.equal(edited.statusCode, 200);
  assert.equal(edited.json().transaction.paid_by, tx.paid_by);
});

test('despesa individual fica restrita ao próprio usuário', async () => {
  const created = await app.inject({
    method: 'POST', url: '/api/v1/transactions', headers: auth(),
    payload: { description: 'Individual privada', amount: '9.99', split_type: 'individual', paid_by: adminId, date: '2026-08-07' },
  });
  assert.equal(created.statusCode, 200);
  const id = created.json().transaction.id;
  const partnerList = await app.inject({ method: 'GET', url: '/api/v1/transactions', headers: authPri() });
  assert.equal(partnerList.json().transactions.some(tx => tx.id === id), false);
  const partnerEdit = await app.inject({ method: 'PATCH', url: `/api/v1/transactions/${id}`, headers: authPri(), payload: { description: 'invadida' } });
  assert.equal(partnerEdit.statusCode, 404);
  const partnerDelete = await app.inject({ method: 'DELETE', url: `/api/v1/transactions/${id}`, headers: authPri() });
  assert.equal(partnerDelete.statusCode, 404);
  const ownDelete = await app.inject({ method: 'DELETE', url: `/api/v1/transactions/${id}`, headers: auth() });
  assert.equal(ownDelete.statusCode, 200);
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
  assert.equal(db.prepare('SELECT count(*) AS n FROM installment_payments WHERE parcela_id = ?').get(parcela.id).n, 1);

  const history = await app.inject({ method: 'GET', url: `/api/v1/parcelas/${parcela.id}/payments`, headers: auth() });
  assert.equal(history.statusCode, 200);
  assert.equal(history.json().payments.length, 1);
  assert.equal(history.json().payments[0].amount, '120.00');

  const reversed = await app.inject({ method: 'DELETE', url: `/api/v1/parcelas/${parcela.id}/payments/${history.json().payments[0].id}`, headers: auth() });
  assert.equal(reversed.statusCode, 200);
  assert.equal(reversed.json().parcela.paid_installments, 0);

  const del = await app.inject({ method: 'DELETE', url: `/api/v1/parcelas/${parcela.id}`, headers: auth() });
  assert.equal(del.statusCode, 200);

  const seeded = await app.inject({ method: 'POST', url: '/api/v1/parcelas', headers: auth(), payload: { name: 'Parcela já paga', total_value: '100.00', total_installments: 3, paid_installments: 2, responsible: adminId } });
  assert.equal(seeded.statusCode, 200);
  assert.equal(seeded.json().parcela.payments.length, 2);
  assert.equal(seeded.json().parcela.paid_value, '66.66');
  await app.inject({ method: 'DELETE', url: `/api/v1/parcelas/${seeded.json().parcela.id}`, headers: auth() });
});

test('parcela individual fica restrita ao responsável', async () => {
  const created = await app.inject({
    method: 'POST', url: '/api/v1/parcelas', headers: auth(),
    payload: { name: 'Parcela privada', total_value: '100.00', total_installments: 2, responsible: adminId, split_type: 'individual' },
  });
  assert.equal(created.statusCode, 200);
  const id = created.json().parcela.id;
  const list = await app.inject({ method: 'GET', url: '/api/v1/parcelas', headers: authPri() });
  assert.equal(list.json().parcelas.some(p => p.id === id), false);
  const pay = await app.inject({ method: 'POST', url: `/api/v1/parcelas/${id}/pay`, headers: authPri() });
  assert.equal(pay.statusCode, 404);
  const del = await app.inject({ method: 'DELETE', url: `/api/v1/parcelas/${id}`, headers: authPri() });
  assert.equal(del.statusCode, 404);
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/v1/parcelas/${id}`, headers: auth() })).statusCode, 200);
});

test('responsável inexistente em parcela responde 422', async () => {
  const res = await app.inject({ method: 'POST', url: '/api/v1/parcelas', headers: auth(), payload: { name: 'Inválida', total_value: '10.00', total_installments: 2, responsible: '00000000-0000-4000-8000-000000000000' } });
  assert.equal(res.statusCode, 422);
  assert.equal(res.json().error.code, 'invalid_responsible');
});

test('pagamento automático liquida uma parcela por fechamento sem duplicar', () => {
  const parcelaId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO parcelas(id, name, total_value_cents, total_installments, paid_installments, due_day, responsible, split_type, icon, category, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(parcelaId, 'Automática', 30000, 3, 0, 5, adminId, 'proportional', 'outros', null, '2026-07-01T12:00:00.000Z', '2026-07-01T12:00:00.000Z');
  db.prepare("INSERT INTO meta(key, value) VALUES ('auto_pay_installments', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run();
  db.prepare("INSERT INTO meta(key, value) VALUES ('auto_pay_last_closing', '2026-07-05') ON CONFLICT(key) DO UPDATE SET value = '2026-07-05'").run();

  const first = runAutomaticInstallments(db, { timezone: config.timezone, today: '2026-08-05' });
  assert.equal(first.processedCycles, 1);
  assert.equal(first.paidInstallments, 1);
  assert.equal(db.prepare('SELECT paid_installments FROM parcelas WHERE id = ?').get(parcelaId).paid_installments, 1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM installment_payments WHERE parcela_id = ?').get(parcelaId).n, 1);

  const replay = runAutomaticInstallments(db, { timezone: config.timezone, today: '2026-08-05' });
  assert.equal(replay.processedCycles, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM installment_payments WHERE parcela_id = ?').get(parcelaId).n, 1);
  db.prepare('DELETE FROM parcelas WHERE id = ?').run(parcelaId);
  db.prepare("UPDATE meta SET value = '0' WHERE key = 'auto_pay_installments'").run();
});

test('pagamento manual no ciclo impede o pagamento automático da parcela seguinte', () => {
  const parcelaId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO parcelas(id, name, total_value_cents, total_installments, paid_installments, due_day, responsible, split_type, icon, category, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(parcelaId, 'Manual no fechamento', 30000, 3, 1, 5, adminId, 'proportional', 'outros', null, '2026-07-01T12:00:00.000Z', '2026-08-04T12:00:00.000Z');
  db.prepare('INSERT INTO installment_payments(id, parcela_id, installment_number, amount_cents, paid_at) VALUES (?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), parcelaId, 1, 10000, '2026-08-04T12:00:00.000Z');
  db.prepare("UPDATE meta SET value = '1' WHERE key = 'auto_pay_installments'").run();
  db.prepare("UPDATE meta SET value = '2026-07-05' WHERE key = 'auto_pay_last_closing'").run();
  const result = runAutomaticInstallments(db, { timezone: config.timezone, today: '2026-08-05' });
  assert.equal(result.paidInstallments, 0);
  assert.equal(db.prepare('SELECT paid_installments FROM parcelas WHERE id = ?').get(parcelaId).paid_installments, 1);
  db.prepare('DELETE FROM parcelas WHERE id = ?').run(parcelaId);
  db.prepare("UPDATE meta SET value = '0' WHERE key = 'auto_pay_installments'").run();
});

test('reativar pagamento automático começa no próximo fechamento, sem retroativo', async () => {
  db.prepare("UPDATE meta SET value = '0' WHERE key = 'auto_pay_installments'").run();
  db.prepare("UPDATE meta SET value = '2026-07-05' WHERE key = 'auto_pay_last_closing'").run();
  const result = await app.inject({ method: 'PATCH', url: '/api/v1/household', headers: auth(), payload: { auto_pay_installments: true } });
  assert.equal(result.statusCode, 200);
  const marker = db.prepare("SELECT value FROM meta WHERE key = 'auto_pay_last_closing'").get().value;
  assert.equal(marker, seedAutoPaymentMarker(todayKey(config.timezone), result.json().household.closing_day));
  db.prepare("UPDATE meta SET value = '0' WHERE key = 'auto_pay_installments'").run();
});

test('alterar fechamento reinicia o marcador do ciclo atual', async () => {
  db.prepare("UPDATE meta SET value = '1' WHERE key = 'auto_pay_installments'").run();
  db.prepare("UPDATE meta SET value = '2026-07-05' WHERE key = 'auto_pay_last_closing'").run();
  const result = await app.inject({ method: 'PATCH', url: '/api/v1/household', headers: auth(), payload: { closing_day: 31 } });
  assert.equal(result.statusCode, 200);
  assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'auto_pay_last_closing'").get().value, seedAutoPaymentMarker(todayKey(config.timezone), 31));
  await app.inject({ method: 'PATCH', url: '/api/v1/household', headers: auth(), payload: { closing_day: 5, auto_pay_installments: false } });
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

  const privateForMember = await app.inject({
    method: 'POST', url: '/api/v1/transactions', headers: auth(),
    payload: { description: 'Individual do membro', amount: '7.00', split_type: 'individual', paid_by: db.prepare('SELECT id FROM users WHERE username = ?').get('priscila').id, date: '2026-08-07' },
  });
  assert.equal(privateForMember.statusCode, 200);

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
  assert.equal(criada.json().data.paid_by, 'priscila');
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

  const segunda = await app.inject({ method: 'POST', url: '/api/v1/agent/expenses', headers: { ...bearer, 'idempotency-key': 'agente-003' }, payload: { description: 'Café', amount: '5.00' } });
  assert.equal(segunda.statusCode, 201);
  const agentExpenses = await app.inject({ method: 'GET', url: '/api/v1/agent/expenses?limit=200', headers: bearer });
  assert.equal(agentExpenses.json().transactions.some(tx => tx.id === privateForMember.json().transaction.id), false);
  await app.inject({ method: 'DELETE', url: `/api/v1/transactions/${privateForMember.json().transaction.id}`, headers: auth() });
  const primeiraPagina = await app.inject({ method: 'GET', url: '/api/v1/agent/expenses?limit=1', headers: bearer });
  assert.equal(primeiraPagina.statusCode, 200);
  assert.equal(primeiraPagina.json().transactions.length, 1);
  assert.equal(primeiraPagina.json().pagination.has_more, true);
  const proxima = await app.inject({ method: 'GET', url: `/api/v1/agent/expenses?limit=1&cursor=${encodeURIComponent(primeiraPagina.json().pagination.next_cursor)}`, headers: bearer });
  assert.equal(proxima.statusCode, 200);
  assert.notEqual(proxima.json().transactions[0].id, primeiraPagina.json().transactions[0].id);
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
