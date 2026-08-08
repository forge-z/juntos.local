/* ══════════════════════════════════════════════
   juntos — i18n (somente pt-BR, idioma fixo)
   ══════════════════════════════════════════════ */

import ptBR from './locales/pt-BR.js';

const DICTS = { 'pt-BR': ptBR };
const FALLBACK = 'pt-BR';

export const SUPPORTED_LOCALES = ['pt-BR'];

export function getLangPref() {
  return 'pt-BR';
}

function lookup(key, locale) {
  const dict = DICTS[locale] || DICTS[FALLBACK];
  if (dict[key] !== undefined) return dict[key];
  return undefined;
}

// t() nunca deixa a UI em branco: se a chave faltar, mostra a própria
// chave (mais fácil de notar um texto faltando do que sumir a tela toda).
export function t(key, params = {}, locale = getLangPref()) {
  let entry = lookup(key, locale);
  if (entry === undefined) return key;
  if (Array.isArray(entry)) {
    const n = Number(params.count ?? 0);
    entry = entry[n === 1 ? 0 : 1];
  }
  return String(entry).replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? ''));
}

export function tError(errorOrCode, fallbackKey = 'errors.generic', locale = getLangPref()) {
  const code = typeof errorOrCode === 'string' ? errorOrCode : (errorOrCode?.message || '');
  return lookup(`errors.${code}`, locale) !== undefined
    ? t(`errors.${code}`, {}, locale)
    : t(fallbackKey, {}, locale);
}

function labelOr(prefix, value, locale) {
  const key = `${prefix}.${value}`;
  return lookup(key, locale) !== undefined ? t(key, {}, locale) : value;
}

export const categoryLabel = (cat, locale) => labelOr('category', cat, locale ?? getLangPref());
export const fiCategoryLabel = (cat, locale) => labelOr('fiCategory', cat, locale ?? getLangPref());
export const divisionLabel = (type, locale) => labelOr('division', type, locale ?? getLangPref());
export const tierLabel = (tier, locale) => labelOr('tier', tier, locale ?? getLangPref());

export function setLang() {
  // idioma fixo em pt-BR — sem seletor
}

export function initLang() {
  if (typeof document !== 'undefined') document.documentElement.lang = 'pt-BR';
}
