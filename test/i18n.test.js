import test from 'node:test';
import assert from 'node:assert/strict';
import {
  t,
  tError,
  getLangPref,
  categoryLabel,
  fiCategoryLabel,
  divisionLabel,
  tierLabel,
} from '../src/i18n/index.js';

test('idioma é fixo em pt-BR', () => {
  assert.equal(getLangPref(), 'pt-BR');
});

test('t() resolve chaves em pt-BR', () => {
  assert.equal(t('common.save'), 'Salvar');
  assert.equal(t('nav.logout'), 'Sair');
});

test('t() cai pra própria chave se faltar em todo lugar', () => {
  assert.equal(t('chave.que.nao.existe.em.lugar.nenhum'), 'chave.que.nao.existe.em.lugar.nenhum');
});

test('t() interpola parâmetros', () => {
  assert.equal(t('common.itemCount', { count: 5 }), '5 itens');
});

test('t() escolhe a forma plural certa', () => {
  assert.equal(t('common.itemCount', { count: 1 }), '1 item');
  assert.equal(t('common.itemCount', { count: 3 }), '3 itens');
});

test('tError resolve um código conhecido e cai no fallback genérico pra código desconhecido', () => {
  assert.equal(tError('no_household'), 'Sem lar ativo');
  assert.equal(tError('codigo_totalmente_desconhecido'), t('errors.generic'));
  assert.equal(tError(new Error('no_household')), 'Sem lar ativo');
});

test('categoryLabel/fiCategoryLabel/divisionLabel/tierLabel traduzem sem alterar o valor gravado', () => {
  assert.equal(categoryLabel('alimentação'), 'Alimentação');
  assert.equal(fiCategoryLabel('casa'), 'Casa');
  assert.equal(divisionLabel('50/50'), '50/50');
  // Categoria desconhecida cai pro próprio valor cru, nunca quebra a renderização.
  assert.equal(categoryLabel('categoria-nova-sem-traducao'), 'categoria-nova-sem-traducao');
});
