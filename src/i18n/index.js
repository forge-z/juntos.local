/* ══════════════════════════════════════════════
   juntos.cash — i18n (pt-BR / en / es)
   ══════════════════════════════════════════════
   Espelha o padrão de src/theme.js: preferência 100% client-side via
   localStorage, sem servidor/perfil envolvido. Única diferença real: na
   primeira visita (sem preferência salva) cai em detectBrowserLang() em
   vez de um valor fixo — depois disso a escolha manual sempre vence. */

import ptBR from './locales/pt-BR.js';
import en from './locales/en.js';
import es from './locales/es.js';

const KEY = 'jc-lang';
export const SUPPORTED_LOCALES = ['pt-BR', 'en', 'es'];
const FALLBACK = 'pt-BR';

const DICTS = { 'pt-BR': ptBR, en, es };

// Aceita um array de idiomas explícito (pra testabilidade sem navigator)
// ou lê de navigator.languages/navigator.language quando disponível.
export function detectBrowserLang(languages) {
  const candidates = languages
    || (typeof navigator !== 'undefined'
      ? ((navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language])
      : []);
  for (const raw of candidates || []) {
    const lower = String(raw || '').toLowerCase();
    if (lower.startsWith('pt')) return 'pt-BR';
    if (lower.startsWith('es')) return 'es';
    if (lower.startsWith('en')) return 'en';
  }
  return FALLBACK;
}

export function getLangPref() {
  try {
    const stored = localStorage.getItem(KEY);
    if (SUPPORTED_LOCALES.includes(stored)) return stored;
  } catch { /* modo privado / sem localStorage */ }
  return detectBrowserLang();
}

function lookup(key, locale) {
  const dict = DICTS[locale] || DICTS[FALLBACK];
  if (dict[key] !== undefined) return dict[key];
  if (DICTS[FALLBACK][key] !== undefined) return DICTS[FALLBACK][key];
  return undefined;
}

// t() nunca deixa a UI em branco: cai pro dicionário pt-BR se a chave
// faltar no idioma ativo, e cai pra própria chave se faltar em todo lugar
// (mais fácil de notar um texto faltando do que sumir a tela toda).
export function t(key, params = {}, locale = getLangPref()) {
  let entry = lookup(key, locale);
  if (entry === undefined) return key;
  if (Array.isArray(entry)) {
    const n = Number(params.count ?? 0);
    entry = entry[n === 1 ? 0 : 1];
  }
  return String(entry).replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? ''));
}

// Serviços lançam códigos estáveis (throw new Error('no_household')), não
// prosa — tError resolve 'errors.<code>' e cai num fallback genérico
// traduzido pra qualquer código não mapeado (nunca mostra erro cru do
// Supabase/Postgres pro usuário).
export function tError(errorOrCode, fallbackKey = 'errors.generic', locale = getLangPref()) {
  const code = typeof errorOrCode === 'string' ? errorOrCode : (errorOrCode?.message || '');
  return lookup(`errors.${code}`, locale) !== undefined
    ? t(`errors.${code}`, {}, locale)
    : t(fallbackKey, {}, locale);
}

// Labels de valores gravados no banco (categoria, tipo de divisão, tier).
// O valor em si nunca muda — só o texto exibido. Cai pro próprio valor
// cru se uma categoria nova aparecer sem tradução ainda (nunca quebra).
function labelOr(prefix, value, locale) {
  const key = `${prefix}.${value}`;
  return lookup(key, locale) !== undefined ? t(key, {}, locale) : value;
}

export const categoryLabel = (cat, locale) => labelOr('category', cat, locale ?? getLangPref());
export const fiCategoryLabel = (cat, locale) => labelOr('fiCategory', cat, locale ?? getLangPref());
export const divisionLabel = (type, locale) => labelOr('division', type, locale ?? getLangPref());
export const tierLabel = (tier, locale) => labelOr('tier', tier, locale ?? getLangPref());

function updateMetaDescription(locale) {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = t('meta.description', {}, locale);
}

// Troca o idioma ativo. Não navega/re-renderiza aqui de propósito — quem
// escuta 'langchange' (main.js) decide como reagir, mantendo este módulo
// livre de depender de router.js (mesmo desacoplamento que theme.js já
// tem hoje com o resto do app).
export function setLang(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  try { localStorage.setItem(KEY, locale); } catch { /* modo privado */ }
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  updateMetaDescription(locale);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('langchange', { detail: { locale } }));
  }
}

export function initLang() {
  const locale = getLangPref();
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  updateMetaDescription(locale);
}
