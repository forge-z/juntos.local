import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, formatCurrency, formatDate } from '../src/pages/_helpers.js';

test('formatCurrency mantém o símbolo R$ fixo e só troca a convenção de separador por idioma', () => {
  assert.equal(formatCurrency(1234.5, 'pt-BR'), 'R$ 1.234,50');
  assert.equal(formatCurrency(1234.5, 'en'), 'R$ 1,234.50');
  assert.equal(formatCurrency(1234.5, 'es'), 'R$ 1234,50');
});

test('formatCurrency trata valor inválido como zero em vez de quebrar', () => {
  assert.equal(formatCurrency('não é número', 'pt-BR'), 'R$ 0,00');
  assert.equal(formatCurrency(undefined, 'en'), 'R$ 0.00');
});

test('formatDate formata dd/mm/aaaa em pt-BR e es, mm/dd/aaaa em en', () => {
  assert.equal(formatDate('2026-07-22', 'pt-BR'), '22/07/2026');
  assert.equal(formatDate('2026-07-22', 'en'), '07/22/2026');
  assert.equal(formatDate('2026-07-22', 'es'), '22/07/2026');
});

test('formatDate não sofre virada de fuso ao redor da meia-noite', () => {
  assert.equal(formatDate('2026-01-01', 'pt-BR'), '01/01/2026');
  assert.equal(formatDate('2026-12-31', 'pt-BR'), '31/12/2026');
});

test('formatDate devolve string vazia sem data', () => {
  assert.equal(formatDate('', 'pt-BR'), '');
  assert.equal(formatDate(null, 'pt-BR'), '');
});

test('escapeHtml torna texto seguro para conteúdo e atributos HTML', () => {
  assert.equal(
    escapeHtml(`<script>"Juntos & cash"'</script>`),
    '&lt;script&gt;&quot;Juntos &amp; cash&quot;&#39;&lt;/script&gt;',
  );
  assert.equal(escapeHtml(null), '');
});
