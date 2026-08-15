import { registerRoute, initRouter, navigate } from './router.js';
import { store } from './store.js';
import { initTheme } from './theme.js';
import { initLang, t } from './i18n/index.js';
import { getSession } from './services/auth.js';
import { loadHousehold } from './services/household.js';
import { escapeHtml } from './pages/_helpers.js';
import loginPage from './pages/login.js';
import dashboardPage from './pages/dashboard.js';
import transactionsPage from './pages/transactions.js';
import parcelasPage from './pages/parcelas.js';
import chartsPage from './pages/charts.js';
import settingsPage from './pages/settings.js';
import setupPage from './pages/setup.js';

initTheme();
initLang();

registerRoute('/', async () => {
  const session = await getSession();
  navigate(session ? '/dashboard' : '/login', true);
});
registerRoute('/login', loginPage);
registerRoute('/setup', async () => setupPage());
const pages = { '/dashboard': dashboardPage, '/transactions': transactionsPage, '/parcelas': parcelasPage, '/charts': chartsPage, '/settings': settingsPage };
for (const [path, handler] of Object.entries(pages)) {
  registerRoute(path, async (params) => {
    const session = await getSession();
    if (!session) return navigate('/login', true);
    store.setState({ user: session.user, session: true, loading: false, tier: 'premium' });
    if (session.setup_required && path !== '/setup') return navigate('/setup', true);
    if (path === '/setup' && !session.setup_required) return navigate('/dashboard', true);
    if (session.must_change_password && !session.setup_required && path !== '/settings') return navigate('/settings', true);
    const household = await loadHousehold();
    if (!household) return navigate('/login', true);
    return handler(params);
  });
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-navigate], [data-reload]');
  if (!target) return;
  if (target.dataset.reload !== undefined) return location.reload();
  navigate(target.dataset.navigate);
});

window.addEventListener('error', (event) => {
  const app = document.getElementById('app');
  if (app) app.innerHTML = `<div class="loading-screen"><div><h2>${t('app.error.title')}</h2><p>${escapeHtml(event.message || 'Erro inesperado')}</p><button class="btn btn-primary" data-reload>${t('common.retry')}</button></div></div>`;
  console.error(event.error || event.message);
});
window.addEventListener('langchange', () => navigate(location.hash.replace(/^#/, '') || '/', true));

document.addEventListener('DOMContentLoaded', async () => {
  try { const session = await getSession(); store.setState({ loading: false, tier: 'premium' }); if (session && (location.hash === '#/' || !location.hash)) navigate('/dashboard', true); else initRouter(); }
  catch (error) { console.error(error); store.setState({ loading: false }); initRouter(); }
});
