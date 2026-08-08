import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHash } from '../src/router.js';

test('router separa caminho e query do retorno do checkout', () => {
  assert.deepEqual(parseHash('#/plans?checkout=success'), {
    path: '/plans',
    query: { checkout: 'success' },
  });
});
