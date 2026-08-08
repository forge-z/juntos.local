/* ══════════════════════════════════════════════
   juntos.cash — Toast Notifications
   ══════════════════════════════════════════════ */

import { t } from '../i18n/index.js';
import { escapeHtml } from '../pages/_helpers.js';

const ICONS = {
  success: 'check-circle',
  error: 'x-circle',
  info: 'info',
  warning: 'warning-circle',
};

export function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', t('toast.regionLabel'));
    container.setAttribute('aria-live', 'polite');
  }

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
  el.setAttribute('aria-atomic', 'true');
  el.innerHTML = `
    <span class="toast-icon"><i class="ph ph-${ICONS[type] || 'info'}" aria-hidden="true"></i></span>
    <span>${escapeHtml(message)}</span>
    <button class="toast-close" type="button" aria-label="${t('toast.closeLabel')}"><i class="ph ph-x" aria-hidden="true"></i></button>
  `;
  el.querySelector('.toast-close').addEventListener('click', () => el.remove());
  container.appendChild(el);

  setTimeout(() => {
    if (el.parentElement) {
      el.style.opacity = '0';
      el.style.transform = 'translateX(40px)';
      el.style.transition = 'all 200ms ease';
      setTimeout(() => el.remove(), 200);
    }
  }, duration);
}
