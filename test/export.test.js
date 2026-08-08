import test from 'node:test';
import assert from 'node:assert/strict';
import { csvEscape } from '../src/services/csv.js';

test('CSV neutraliza células que seriam interpretadas como fórmula', () => {
  assert.equal(csvEscape('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(csvEscape('+1;2'), "\"'+1;2\"");
  assert.equal(csvEscape('descrição comum'), 'descrição comum');
});
