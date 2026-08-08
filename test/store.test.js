import test from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/store.js';

test('store expõe o estado inicial usado pelo aplicativo', () => {
  assert.deepEqual(store.state, {
    user: null,
    session: null,
    tier: 'premium',
    household: null,
    loading: true,
    transactions: [],
    parcelas: [],
    currentRoute: '',
  });
});

test('setState mescla atualizações sem apagar os demais campos', () => {
  store.setState({ tier: 'premium', loading: false });

  assert.equal(store.state.tier, 'premium');
  assert.equal(store.state.loading, false);
  assert.equal(store.state.household, null);

  store.setState({ tier: 'premium', loading: true });
});
