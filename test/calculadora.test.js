import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectedInstallmentValue } from '../src/services/calculadora.js';

test('parcela simples: valor projetado = total / quantidade', () => {
  const parcela = { total_value: '1200.00', total_installments: 10, paid_installments: 0 };
  assert.equal(getProjectedInstallmentValue(parcela), 120);
  assert.equal(getProjectedInstallmentValue(parcela, 3), 120);
});

test('parcelas pagas não projetam mais valor', () => {
  const paga = { total_value: '1200.00', total_installments: 10, paid_installments: 10 };
  assert.equal(getProjectedInstallmentValue(paga), 0);
  const quase = { total_value: '1200.00', total_installments: 10, paid_installments: 9 };
  assert.equal(getProjectedInstallmentValue(quase), 120);
  assert.equal(getProjectedInstallmentValue(quase, 1), 0);
});
