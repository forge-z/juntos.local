import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateContribution } from '../src/services/balance.js';

test('contribuição mistura corretamente 50/50, proporcional e individual', () => {
  const records = [
    { amount: 100, split_type: 'equal', paid_by: 'me' },
    { amount: 100, split_type: 'proportional', paid_by: 'partner' },
    { amount: 40, split_type: 'individual', paid_by: 'partner' },
  ];
  const result = calculateContribution(records, 'me', 6000, 4000);
  assert.equal(result.myPaid, 100);
  assert.equal(result.partnerPaid, 140);
  assert.equal(result.myExpected, 110);
  assert.equal(result.partnerExpected, 130);
  assert.equal(result.myBalance, -10);
  assert.equal(result.partnerBalance, 10);
});

test('rateio proporcional preserva a soma exata em centavos', () => {
  const result = calculateContribution([
    { amount: 0.01, split_type: 'proportional', paid_by: 'me' },
  ], 'me', 1, 2);
  assert.equal(result.myExpected, 0);
  assert.equal(result.partnerExpected, 0.01);
  assert.equal(result.myExpected + result.partnerExpected, 0.01);
});
