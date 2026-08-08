/* ══════════════════════════════════════════════
   juntos.cash — Conteúdo de ajuda
   Dispatcher fino por idioma — o conteúdo de verdade (tutorial, FAQ,
   dicas financeiras, guia de financiamentos) mora em src/i18n/content/.
   Exporta funções (não arrays estáticos) porque o conteúdo certo só é
   conhecido no momento da chamada, lendo getLangPref() — mesmo motivo de
   TIER_LABELS/TIER_PRICES virarem função em subscription.js.
   ══════════════════════════════════════════════ */

import { getLangPref } from '../i18n/index.js';
import * as ptBR from '../i18n/content/helpContent.pt-BR.js';
import * as en from '../i18n/content/helpContent.en.js';
import * as es from '../i18n/content/helpContent.es.js';

const CONTENT = { 'pt-BR': ptBR, en, es };

function content() {
  return CONTENT[getLangPref()] || CONTENT['pt-BR'];
}

export const TUTORIAL_STEPS = () => content().TUTORIAL_STEPS;
export const FAQ_ITEMS = () => content().FAQ_ITEMS;
export const FINANCE_TIPS = () => content().FINANCE_TIPS;
export const FINANCING_GUIDE = () => content().FINANCING_GUIDE;
