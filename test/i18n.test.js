import test from 'node:test';
import assert from 'node:assert/strict';
import {
  t,
  tError,
  detectBrowserLang,
  categoryLabel,
  fiCategoryLabel,
  divisionLabel,
  tierLabel,
} from '../src/i18n/index.js';

test('t() resolve uma chave conhecida no idioma pedido', () => {
  assert.equal(t('common.save', {}, 'en'), 'Save');
  assert.equal(t('common.save', {}, 'es'), 'Guardar');
  assert.equal(t('common.save', {}, 'pt-BR'), 'Salvar');
});

test('t() cai pra pt-BR quando a chave falta no idioma alvo, e pra própria chave se faltar em todo lugar', () => {
  assert.equal(t('errors.no_household', {}, 'en'), 'No active household');
  assert.equal(t('chave.que.nao.existe.em.lugar.nenhum'), 'chave.que.nao.existe.em.lugar.nenhum');
});

test('t() interpola parâmetros', () => {
  assert.equal(t('common.itemCount', { count: 5 }, 'en'), '5 items');
});

test('t() escolhe a forma plural certa', () => {
  assert.equal(t('common.itemCount', { count: 1 }, 'en'), '1 item');
  assert.equal(t('common.itemCount', { count: 3 }, 'en'), '3 items');
  assert.equal(t('common.itemCount', { count: 1 }, 'pt-BR'), '1 item');
  assert.equal(t('common.itemCount', { count: 3 }, 'pt-BR'), '3 itens');
});

test('detectBrowserLang mapeia variantes de idioma pro locale suportado mais próximo', () => {
  assert.equal(detectBrowserLang(['pt-PT', 'en-US']), 'pt-BR');
  assert.equal(detectBrowserLang(['es-MX']), 'es');
  assert.equal(detectBrowserLang(['en-GB']), 'en');
  assert.equal(detectBrowserLang(['fr-FR', 'de-DE']), 'pt-BR');
  assert.equal(detectBrowserLang([]), 'pt-BR');
});

test('tError resolve um código conhecido e cai no fallback genérico pra código desconhecido', () => {
  assert.equal(tError('no_household', 'errors.generic', 'en'), 'No active household');
  assert.equal(tError('codigo_totalmente_desconhecido', 'errors.generic', 'en'), t('errors.generic', {}, 'en'));
  assert.equal(tError(new Error('no_household'), 'errors.generic', 'pt-BR'), 'Sem lar ativo');
});

test('categoryLabel/fiCategoryLabel/divisionLabel/tierLabel traduzem sem alterar o valor gravado', () => {
  assert.equal(categoryLabel('alimentação', 'en'), 'Food');
  assert.equal(fiCategoryLabel('casa', 'es'), 'Casa');
  assert.equal(divisionLabel('50/50', 'en'), '50/50');
  assert.equal(tierLabel('pro', 'es'), 'Pro');
  // Categoria desconhecida (ainda sem tradução) cai pro próprio valor cru,
  // nunca quebra a renderização.
  assert.equal(categoryLabel('categoria-nova-sem-traducao', 'en'), 'categoria-nova-sem-traducao');
});
