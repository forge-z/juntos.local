/* ══════════════════════════════════════════════
   juntos.cash — Exportação de dados (CSV)
   ══════════════════════════════════════════════ */

import { loadTransactions, splitTypeToDivision } from './transaction.js';
import { loadParcelas } from './parcela.js';
import { getProjectedInstallmentValue } from './calculadora.js';
import { localDateKey } from './reporting-period.js';
import { csvEscape } from './csv.js';
import { t, categoryLabel, divisionLabel } from '../i18n/index.js';
import { checkFeature } from './subscription.js';

const PARCELA_TYPE_LABELS = () => ({
  parcelado: t('parcelas.typeSimple'),
});

function rowsToCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(';')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(';'));
  }
  return lines.join('\n');
}

// Exporta gastos e parcelas do lar num único CSV, direto do client (RLS já
// garante que só vem o que o usuário tem acesso). Sem Edge Function — é só
// leitura de dados que o próprio usuário já pode ver.
// Exportação é paga; no plano gratuito só é permitida durante encerramento.
export async function exportHistoryCSV({ duringAccountClosure = false } = {}) {
  if (!checkFeature('export') && !duringAccountClosure) throw new Error('feature_not_available');
  const [transactions, parcelas] = await Promise.all([
    loadTransactions(),
    loadParcelas(),
  ]);

  const typeLabels = PARCELA_TYPE_LABELS();

  const txCsv = rowsToCsv(
    [t('export.dateHeader'), t('export.descriptionHeader'), t('common.category'), t('export.amountHeader'), t('common.division'), t('export.paidByHeader')],
    transactions.map(tx => [tx.date, tx.description, categoryLabel(tx.category), tx.amount, divisionLabel(splitTypeToDivision(tx.split_type)), tx.paid_by_manual || tx.paid_by]),
  );

  const parcelasCsv = rowsToCsv(
    [t('common.name'), t('export.typeHeader'), t('export.totalValueHeader'), t('export.paidInstallmentsHeader'), t('export.totalInstallmentsHeader'), t('export.installmentValueHeader')],
    parcelas.map(p => [p.name, typeLabels[p.type] || p.type, p.total_value, p.paid_installments, p.total_installments, getProjectedInstallmentValue(p)]),
  );

  const content = `${t('export.expensesSection')}\n${txCsv}\n\n${t('export.installmentsSection')}\n${parcelasCsv}\n`;
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `juntos-cash-dados-${localDateKey()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
