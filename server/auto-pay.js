import crypto from 'node:crypto';
import { todayKey } from './db.js';

function dateAtNoon(year, month, day) {
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

function dateKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function parseDateKey(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return dateAtNoon(year, month - 1, day);
}

export function closingDateForMonth(year, month, closingDay = 5) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const rule = Number(closingDay);
  if (rule === 0) return dateAtNoon(year, month, lastDay);
  if (rule < 0) {
    const ordinal = Math.min(Math.max(Math.abs(Math.trunc(rule)), 1), 5);
    let businessDays = 0;
    for (let day = 1; day <= lastDay; day += 1) {
      const candidate = dateAtNoon(year, month, day);
      const weekday = candidate.getUTCDay();
      if (weekday !== 0 && weekday !== 6) {
        businessDays += 1;
        if (businessDays === ordinal) return candidate;
      }
    }
  }
  return dateAtNoon(year, month, Math.min(Math.max(Math.trunc(rule || 5), 1), lastDay));
}

export function latestClosingKey(today = todayKey('UTC'), closingDay = 5) {
  const current = parseDateKey(today);
  let closing = closingDateForMonth(current.getUTCFullYear(), current.getUTCMonth(), closingDay);
  if (closing > current) closing = closingDateForMonth(current.getUTCFullYear(), current.getUTCMonth() - 1, closingDay);
  return dateKey(closing);
}

export function previousClosingKey(closingKey, closingDay = 5) {
  const closing = parseDateKey(closingKey);
  return dateKey(closingDateForMonth(closing.getUTCFullYear(), closing.getUTCMonth() - 1, closingDay));
}

function closingKeysAfter(lastKey, latestKey, closingDay) {
  const last = parseDateKey(lastKey);
  const latest = parseDateKey(latestKey);
  const keys = [];
  let month = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1, 12));
  while (month <= latest) {
    const closing = closingDateForMonth(month.getUTCFullYear(), month.getUTCMonth(), closingDay);
    if (closing > last && closing <= latest) keys.push(dateKey(closing));
    month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1, 12));
  }
  return keys;
}

export function seedAutoPaymentMarker(today, closingDay) {
  const latest = latestClosingKey(today, closingDay);
  return latest === today ? previousClosingKey(latest, closingDay) : latest;
}

export function runAutomaticInstallments(db, { timezone = 'America/Sao_Paulo', today = todayKey(timezone) } = {}) {
  const enabled = db.prepare("SELECT value FROM meta WHERE key = 'auto_pay_installments'").get()?.value === '1';
  if (!enabled) return { processedCycles: 0, paidInstallments: 0 };

  const closingDay = Number(db.prepare("SELECT value FROM meta WHERE key = 'closing_day'").get()?.value || 5);
  const latest = latestClosingKey(today, closingDay);
  let last = db.prepare("SELECT value FROM meta WHERE key = 'auto_pay_last_closing'").get()?.value;
  if (!last) {
    db.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run('auto_pay_last_closing', seedAutoPaymentMarker(today, closingDay));
    return { processedCycles: 0, paidInstallments: 0 };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(last)) {
    db.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run('auto_pay_last_closing', latest);
    return { processedCycles: 0, paidInstallments: 0 };
  }
  if (last >= latest) return { processedCycles: 0, paidInstallments: 0 };

  const cycles = closingKeysAfter(last, latest, closingDay);
  let paidInstallments = 0;
  const upsertMeta = db.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const closingKey of cycles) {
    db.exec('BEGIN');
    try {
      const parcelas = db.prepare(
        `SELECT * FROM parcelas
         WHERE paid_installments < total_installments
           AND substr(created_at, 1, 10) <= ?
         ORDER BY created_at ASC, id ASC`,
      ).all(closingKey);
      const previousClosing = previousClosingKey(closingKey, closingDay);
      const hasCyclePayment = db.prepare(
        `SELECT 1 FROM installment_payments
         WHERE parcela_id = ?
           AND (cycle_closing_key = ? OR (cycle_closing_key IS NULL AND substr(paid_at, 1, 10) > ? AND substr(paid_at, 1, 10) <= ?))
         LIMIT 1`,
      );
      const insertPayment = db.prepare('INSERT INTO installment_payments(id, parcela_id, installment_number, amount_cents, paid_at, cycle_closing_key) VALUES (?, ?, ?, ?, ?, ?)');
      const updateParcela = db.prepare('UPDATE parcelas SET paid_installments = ?, updated_at = ? WHERE id = ?');
      const paidAt = `${closingKey}T12:00:00.000Z`;
      const updatedAt = new Date().toISOString();
      for (const parcela of parcelas) {
        if (hasCyclePayment.get(parcela.id, closingKey, previousClosing, closingKey)) continue;
        const installmentNumber = parcela.paid_installments + 1;
        const base = Math.floor(parcela.total_value_cents / parcela.total_installments);
        const amountCents = installmentNumber === parcela.total_installments
          ? parcela.total_value_cents - base * (parcela.total_installments - 1)
          : base;
        insertPayment.run(crypto.randomUUID(), parcela.id, installmentNumber, amountCents, paidAt, closingKey);
        updateParcela.run(installmentNumber, updatedAt, parcela.id);
        paidInstallments += 1;
      }
      upsertMeta.run('auto_pay_last_closing', closingKey);
      db.exec('COMMIT');
      last = closingKey;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return { processedCycles: cycles.length, paidInstallments };
}
