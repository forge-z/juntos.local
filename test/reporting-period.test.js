import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dateKeyInPeriod,
  getClosingDate,
  getCurrentReportingPeriod,
  formatReportingPeriod,
  localDateKey,
} from '../src/services/reporting-period.js';

test('fechamento fixo cria ciclo entre o dia seguinte e o próximo fechamento', () => {
  const period = getCurrentReportingPeriod(new Date(2026, 6, 21, 12), 5);
  assert.equal(period.startKey, '2026-07-06');
  assert.equal(period.endKey, '2026-08-05');
  assert.equal(dateKeyInPeriod('2026-07-06', period), true);
  assert.equal(dateKeyInPeriod('2026-08-06', period), false);
});

test('fechamento no último dia respeita fevereiro bissexto', () => {
  assert.equal(localDateKey(getClosingDate(2028, 1, 0)), '2028-02-29');
});

test('fechamento em dia útil ignora sábado e domingo', () => {
  assert.equal(localDateKey(getClosingDate(2026, 7, -1)), '2026-08-03');
  assert.equal(localDateKey(getClosingDate(2026, 7, -2)), '2026-08-04');
});

test('formatReportingPeriod usa nomes de mês em inglês quando o locale é en', () => {
  const period = getCurrentReportingPeriod(new Date(2026, 6, 21, 12), 5);
  const ptLabel = formatReportingPeriod(period, 'pt-BR');
  const enLabel = formatReportingPeriod(period, 'en');
  assert.match(ptLabel, /jul\./i);
  assert.match(enLabel, /Jul/);
  assert.notEqual(ptLabel, enLabel);
});
