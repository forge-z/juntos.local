/* ══════════════════════════════════════════════
   juntos.cash — Seletor de idioma (botão de ciclo)
   ══════════════════════════════════════════════
   Mesmo padrão do botão de tema (theme.js / _layout.js / landing.js):
   um único botão, clique cicla pra próxima opção, sem popup — a troca de
   idioma força um re-render completo via o listener de 'langchange' em
   main.js, então o botão não precisa se auto-atualizar depois do clique
   (ao contrário do tema, que faz um patch manual porque não há
   re-render). Para escolha direta (não cíclica), ver o controle
   segmentado "Idioma" em settings.js, no mesmo espírito do "Tema".
   ══════════════════════════════════════════════ */

import { getLangPref, setLang, SUPPORTED_LOCALES, t } from '../i18n/index.js';

const SHORT_LABEL = { 'pt-BR': 'PT', en: 'EN', es: 'ES' };

export function langSwitchShortLabel(locale = getLangPref()) {
  return SHORT_LABEL[locale] || 'PT';
}

export function renderLangSwitchBtn(id, extraClass = '') {
  return `
    <button class="btn btn-ghost btn-sm lang-switch-btn${extraClass ? ' ' + extraClass : ''}" id="${id}" title="${t('common.toggleLanguage')}" aria-label="${t('common.toggleLanguage')}">
      <i class="ph ph-translate"></i> ${langSwitchShortLabel()}
    </button>
  `;
}

export function wireLangSwitchBtn(id) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('click', () => {
    const current = getLangPref();
    const idx = SUPPORTED_LOCALES.indexOf(current);
    const next = SUPPORTED_LOCALES[(idx + 1) % SUPPORTED_LOCALES.length];
    setLang(next);
  });
}
