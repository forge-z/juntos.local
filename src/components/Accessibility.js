import { t } from '../i18n/index.js';

let generatedId = 0;

function labelDialog(dialog) {
  const heading = dialog.querySelector('h1, h2, h3');
  if (heading) {
    if (!heading.id) heading.id = 'modal-title-' + (++generatedId);
    dialog.setAttribute('aria-labelledby', heading.id);
  } else if (!dialog.hasAttribute('aria-label')) {
    dialog.setAttribute('aria-label', t('a11y.dialog'));
  }
}

export function enhanceAccessibility(root = document) {
  root.querySelectorAll('.ph').forEach(icon => icon.setAttribute('aria-hidden', 'true'));
  root.querySelectorAll('.form-error').forEach(error => {
    error.setAttribute('role', 'alert');
    error.setAttribute('aria-live', 'assertive');
  });
  root.querySelectorAll('.loading-screen').forEach(loading => {
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-live', 'polite');
  });
  root.querySelectorAll('button').forEach(button => {
    if (button.textContent.trim() || button.getAttribute('aria-label')) return;
    const descriptor = ((button.id || '') + ' ' + (button.className || '')).toLowerCase();
    const inferred = button.title ||
      (/close|cancel/.test(descriptor) ? t('common.close') :
        /del|trash/.test(descriptor) ? t('common.delete') :
          /edit/.test(descriptor) ? t('common.edit') : t('a11y.action'));
    button.setAttribute('aria-label', inferred);
  });
  root.querySelectorAll('dialog.modal-overlay').forEach(labelDialog);
}
