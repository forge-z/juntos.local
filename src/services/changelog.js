/* ══════════════════════════════════════════════
   juntos.cash — App Version + Changelog
   Dispatcher fino por idioma — o histórico de versões de verdade mora em
   src/i18n/content/changelog.*.js. APP_VERSION é igual nos 3 idiomas
   (número de versão não se traduz), mantido como export direto; CHANGELOG
   vira função pelo mesmo motivo de helpContent.js — o conteúdo certo só é
   conhecido no momento da chamada, lendo getLangPref().
   ══════════════════════════════════════════════ */

import { getLangPref } from '../i18n/index.js';
import * as ptBR from '../i18n/content/changelog.pt-BR.js';
import * as en from '../i18n/content/changelog.en.js';
import * as es from '../i18n/content/changelog.es.js';

const CONTENT = { 'pt-BR': ptBR, en, es };

export const APP_VERSION = ptBR.APP_VERSION;

export const CHANGELOG = () => (CONTENT[getLangPref()] || CONTENT['pt-BR']).CHANGELOG;
