/* ══════════════════════════════════════════════
   juntos.cash — App Layout (Sidebar + Content)
   ══════════════════════════════════════════════ */

import { store } from '../store.js';
import { navigate } from '../router.js';
import { logout } from '../services/auth.js';
import { showToast } from '../components/Toast.js';
import { confirmDialog } from '../components/Confirm.js';
import { t, tError } from '../i18n/index.js';
import { escapeHtml } from './_helpers.js';

const NAV_ITEMS = () => [
  { id: 'dashboard', label: t('nav.dashboard'), icon: 'chart-bar', href: '#/dashboard' },
  { id: 'transactions', label: t('nav.transactions'), icon: 'credit-card', href: '#/transactions' },
  { id: 'parcelas', label: t('nav.parcelas'), icon: 'package', href: '#/parcelas' },
  { id: 'charts', label: t('nav.charts'), icon: 'chart-line', href: '#/charts' },
  { id: 'settings', label: t('nav.settings'), icon: 'gear', href: '#/settings' },
];

export function renderAppLayout(activePage) {
  const app = document.getElementById('app');
  const user = store.state.user;
  const household = store.state.household;
  const name = user?.user_metadata?.name || user?.email?.split('@')[0] || t('layout.defaultUserName');
  const initial = name.charAt(0).toUpperCase();
  const navItems = NAV_ITEMS();

  app.innerHTML = `
    <button class="skip-link" type="button" id="skip-content-btn">${t('nav.skipToContent')}</button>
    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-logo">
          <i class="ph ph-heart" style="font-size:1.25rem;color:var(--brand);"></i>
          <span>juntos</span>
        </div>
        <nav class="sidebar-nav" aria-label="${t('nav.mainNav')}">
          ${navItems.map(item => `
            <a href="${item.href}" class="${item.id === activePage ? 'active' : ''}" ${item.id === activePage ? 'aria-current="page"' : ''}>
              <span class="nav-icon"><i class="ph ph-${item.icon}"></i></span>
              <span>${item.label}</span>
            </a>
          `).join('')}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="sidebar-avatar">${initial}</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${escapeHtml(name)}</div>
              ${household?.name ? `<div class="sidebar-user-home"><i class="ph ph-house"></i> ${escapeHtml(household.name)}</div>` : ''}
            </div>
          </div>
          <div class="sidebar-actions">
            <button class="btn btn-ghost btn-sm sidebar-action-btn" id="logout-btn" title="${t('nav.logout')}" aria-label="${t('nav.logout')}">
              <i class="ph ph-sign-out"></i> ${t('nav.logout')}
            </button>
          </div>
        </div>
      </aside>

      <main class="main-content" id="main-content">
        <div id="page-content" tabindex="-1"></div>
      </main>

      <nav class="bottom-nav" aria-label="${t('nav.mobileNav')}">
        <div class="bottom-nav-inner">
          ${navItems.map(item => `
            <a href="${item.href}" class="${item.id === activePage ? 'active' : ''}" ${item.id === activePage ? 'aria-current="page"' : ''}>
              <span class="nav-icon"><i class="ph ph-${item.icon}"></i></span>
              ${item.label}
            </a>
          `).join('')}
        </div>
      </nav>
    </div>
  `;

  document.getElementById('skip-content-btn')?.addEventListener('click', () => {
    document.getElementById('page-content')?.focus({ preventScroll: false });
  });

  // Logout handler
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: t('nav.logoutConfirmTitle'),
        message: t('nav.logoutConfirmMessage'),
        confirmLabel: t('nav.logoutConfirmLabel'),
        danger: true,
      });
      if (!ok) return;
      try {
        await logout();
        navigate('/login');
        showToast(t('nav.loggedOutToast'), 'info');
      } catch (err) {
        showToast(tError(err), 'error');
      }
    });
  }
}
