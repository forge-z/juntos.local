/* ══════════════════════════════════════════════
   juntos.cash — Hash Router
   ══════════════════════════════════════════════ */

import { store } from './store.js';
import { enhanceAccessibility } from './components/Accessibility.js';
import { t } from './i18n/index.js';

const routes = new Map();
let currentCleanup = null;
let navigationId = 0;

export function registerRoute(pattern, handler) {
  routes.set(pattern, handler);
}

export function parseHash(hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const queryIndex = raw.indexOf('?');
  const path = queryIndex >= 0 ? raw.slice(0, queryIndex) : raw;
  const search = queryIndex >= 0 ? raw.slice(queryIndex + 1) : '';
  return {
    path: path || '/',
    query: Object.fromEntries(new URLSearchParams(search)),
  };
}

export function matchRoute(hash) {
  const { path, query } = parseHash(hash);
  for (const [pattern, handler] of routes) {
    const regex = new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$');
    const match = path.match(regex);
    if (match) {
      const params = {};
      const keys = pattern.match(/:(\w+)/g) || [];
      keys.forEach((key, i) => {
        params[key.slice(1)] = match[i + 1];
      });
      return { handler, params: { ...params, query }, path, query };
    }
  }
  return null;
}

export function navigate(href, replace = false) {
  const hash = href.startsWith('#') ? href : '#' + href;
  if (replace) {
    history.replaceState(null, '', hash);
  } else {
    history.pushState(null, '', hash);
  }
  handleRoute();
}


async function handleRoute() {
  const thisNavigation = ++navigationId;
  const hash = location.hash || '#/';
  store.setState({ currentRoute: hash });

  const match = matchRoute(hash);
  const app = document.getElementById('app');
  if (!app) return;

  // Cleanup previous page
  if (currentCleanup && typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (e) { console.error('Cleanup error:', e); }
    currentCleanup = null;
  }

  if (!match) {
    navigate('/');
    return;
  }

  // Loading state
  app.innerHTML = `
    <div class="loading-screen">
      <div class="spinner"></div>
      <span>${t('common.loading')}</span>
    </div>
  `;

  try {
    const result = await match.handler(match.params);
    // A newer navigation won the race while this page was loading.
    if (thisNavigation !== navigationId) {
      if (typeof result === 'function') {
        try { result(); } catch (e) { console.error('Stale cleanup error:', e); }
      }
      return;
    }
    if (result && typeof result === 'function') {
      currentCleanup = result;
    }

    enhanceAccessibility(app);
    const routeHeading = app.querySelector('#page-content h1, .auth-card h1, .hero h1');
    if (routeHeading) {
      routeHeading.tabIndex = -1;
      // Não é alcançável via Tab (tabIndex -1), então o anel de foco nunca
      // ajuda usuário de teclado vidente — só existe pra leitor de tela
      // anunciar o título após navegar. Ver regra correspondente em base.css.
      routeHeading.dataset.routeFocus = '';
      routeHeading.focus({ preventScroll: true });
    }
  } catch (err) {
    if (thisNavigation !== navigationId) return;
    console.error('Route error:', err);
    app.innerHTML = `
      <div class="loading-screen">
        <span class="text-danger">${t('app.error.routeFailed')}</span>
        <button class="btn btn-outline" data-reload>${t('common.retry')}</button>
      </div>
    `;
  }
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('popstate', handleRoute);
  handleRoute();
}
