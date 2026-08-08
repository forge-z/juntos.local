/* juntos — Tema sempre acompanha o sistema (sem seletor) */

export function applySystemTheme() {
  if (typeof document === 'undefined') return;
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#0D0D13' : '#F6F6FA';
}

export function initTheme() {
  applySystemTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySystemTheme);
}
