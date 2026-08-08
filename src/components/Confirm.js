/* ══════════════════════════════════════════════
   juntos.cash — Confirmação com dialog nativo
   ══════════════════════════════════════════════ */

import { t } from '../i18n/index.js';
import { escapeHtml } from '../pages/_helpers.js';

let dialogId = 0;

export function confirmDialog({
  title = t('common.confirm'),
  message = '',
  confirmLabel = t('common.confirm'),
  cancelLabel = t('common.cancel'),
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    const id = ++dialogId;
    let closed = false;

    dialog.className = 'modal-overlay';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-labelledby', `confirm-title-${id}`);
    if (message) dialog.setAttribute('aria-describedby', `confirm-message-${id}`);
    dialog.innerHTML = `
      <div class="modal" style="max-width:400px;">
        <h2 id="confirm-title-${id}" style="margin-bottom:12px;">${escapeHtml(title)}</h2>
        ${message ? `<p id="confirm-message-${id}" style="font-size:0.875rem;color:var(--body-dark);line-height:1.6;margin-bottom:4px;">${escapeHtml(message)}</p>` : ''}
        <div class="modal-actions">
          <button type="button" class="btn btn-outline" data-action="cancel" autofocus>${escapeHtml(cancelLabel)}</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    function close(result) {
      if (closed) return;
      closed = true;
      dialog.close();
      dialog.remove();
      resolve(result);
    }

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      close(false);
    });
    dialog.addEventListener('pointerdown', event => {
      if (event.target === dialog) close(false);
    });
    dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    dialog.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));

    document.body.appendChild(dialog);
    dialog.showModal();
  });
}
