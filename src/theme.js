/* ══════════════════════════════════════════════
   juntos.cash — Tema claro/escuro
   ══════════════════════════════════════════════ */

const KEY = 'jc-theme'; // 'dark' | 'light' | 'system'

export function getThemePref() {
  try { return localStorage.getItem(KEY) || 'dark'; } catch { return 'dark'; }
}

export function resolveTheme(pref) {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return pref;
}

export function applyThemePref(pref) {
  try { localStorage.setItem(KEY, pref); } catch { /* private mode */ }
  const theme = resolveTheme(pref);
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#F6F6FA' : '#0D0D13';
  window.dispatchEvent(new CustomEvent('themechange', { detail: { pref, theme } }));
}

export function toggleTheme() {
  const current = resolveTheme(getThemePref());
  applyThemePref(current === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  applyThemePref(getThemePref());
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (getThemePref() === 'system') applyThemePref('system');
  });
}
