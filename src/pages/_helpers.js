/* ══════════════════════════════════════════════
   juntos.cash — Helpers
   ══════════════════════════════════════════════ */

import { getLangPref } from '../i18n/index.js';

// A moeda local é sempre BRL; só a convenção de separador decimal/milhar muda por
// idioma. 'R$ ' fica como prefixo literal (em vez de currencyDisplay do Intl)
// pra manter o símbolo estável entre os 3 idiomas.
export function formatCurrency(value, locale = getLangPref()) {
  let num = Number(value);
  if (isNaN(num)) num = 0;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  return 'R$ ' + formatted;
}

export function formatDate(dateStr, locale = getLangPref(), opts) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12); // meio-dia evita virada de fuso
  return new Intl.DateTimeFormat(locale, opts || { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

const HTML_ENTITIES = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;',
  '"': '&quot;', "'": '&#39;',
};

export function escapeHtml(text) {
  return String(text ?? '').replace(
    /[&<>"']/g,
    char => HTML_ENTITIES[char],
  );
}
