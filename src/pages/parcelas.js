/* juntos — Parcelas simples */

import { store } from '../store.js';
import { loadParcelas, createParcela, payInstallment, deleteParcela, FI_CATEGORIES, getFiIcon } from '../services/parcela.js';
import { getMembers } from '../services/household.js';
import { getProjectedInstallmentValue } from '../services/calculadora.js';
import { renderAppLayout } from './_layout.js';
import { enhanceAccessibility } from '../components/Accessibility.js';
import { escapeHtml, formatCurrency } from './_helpers.js';
import { showToast } from '../components/Toast.js';
import { confirmDialog } from '../components/Confirm.js';
import { t, tError, fiCategoryLabel, divisionLabel } from '../i18n/index.js';

export default async function parcelasPage() {
  const app = document.getElementById('app');
  document.body.className = '';
  renderAppLayout('parcelas');

  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="loading-screen"><div class="spinner"></div><span>${t('common.loading')}</span></div>`;

  try {
    const [parcelas, members] = await Promise.all([loadParcelas(), getMembers()]);
    const user = store.state.user;
    const partner = members.find(m => m.user_id !== user.id);

    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1><i class="ph ph-house"></i> ${t('parcelas.title')}</h1>
          <div class="page-subtitle">${t('parcelas.subtitle')}</div>
        </div>
        <button class="btn btn-primary" id="new-parcela-btn"><i class="ph ph-plus"></i> ${t('parcelas.new')}</button>
      </div>

      ${parcelas.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="ph ph-package" style="font-size:2rem;"></i></div>
          <div class="empty-state-title">${t('parcelas.emptyTitle')}</div>
          <div class="empty-state-text">${t('parcelas.emptyText')}</div>
        </div>
      ` : `
        <div class="parcela-list">
          ${parcelas.map(p => {
            const remaining = p.total_installments - p.paid_installments;
            const currentValue = getProjectedInstallmentValue(p);
            const progress = p.total_installments > 0 ? Math.round((p.paid_installments / p.total_installments) * 100) : 0;
            const isMine = p.responsible === user.id;
            return `
              <div class="financing-card">
                <div class="financing-header">
                  <div class="financing-name">
                    <span class="fi-icon"><i class="ph ph-${getFiIcon(p.icon)}"></i></span>
                    <span>${escapeHtml(p.name)}</span>
                    <span class="badge badge-brand" style="font-size:0.625rem;">${t('parcelas.typeSimple')}</span>
                    ${!isMine && partner ? `<span class="badge badge-brand" style="font-size:0.625rem;">${escapeHtml(partner.name)}</span>` : ''}
                  </div>
                  <span style="font-family:var(--font-mono);font-size:0.875rem;font-weight:600;color:var(--heading-dark);">${formatCurrency(p.total_value)}</span>
                </div>
                <div class="financing-progress">
                  <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px;">
                    <span style="color:var(--body-dark)">${t('parcelas.installmentsOf', { paid: p.paid_installments, total: p.total_installments })}</span>
                    <span style="color:var(--heading-dark);font-weight:500;">${progress}%</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-bar-fill ${progress >= 80 ? 'success' : progress >= 50 ? '' : 'warning'}" style="width:${progress}%"></div>
                  </div>
                </div>
                <div class="financing-info">
                  <span><i class="ph ph-currency-circle-dollar"></i> ${formatCurrency(currentValue)}${t('common.perMonth')}</span>
                  <span><i class="ph ph-calendar"></i> ${t('parcelas.remaining', { count: remaining })}</span>
                </div>
                <div class="financing-actions">
                  ${p.paid_installments < p.total_installments ? `
                    <button class="btn btn-primary btn-sm pay-parcela-btn" data-parcela-id="${p.id}"><i class="ph ph-check-circle"></i> ${t('parcelas.payInstallment')}</button>
                  ` : `
                    <span class="badge badge-success"><i class="ph ph-check-circle"></i> ${t('parcelas.fullyPaid')}</span>
                  `}
                  <button class="btn btn-danger btn-sm del-parcela-btn" data-parcela-id="${p.id}"><i class="ph ph-trash"></i> ${t('common.delete')}</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}

      <!-- Modal: Nova Parcela -->
      <dialog id="parcela-modal" class="modal-overlay">
        <div class="modal" style="max-width:560px;">
          <h2>${t('parcelas.modalTitle')}</h2>
          <form id="parcela-form">
            <div class="grid-2" style="margin-bottom:12px;">
              <div class="input-group">
                <label for="p-name">${t('common.name')}</label>
                <input type="text" id="p-name" class="input" placeholder="${t('parcelas.namePlaceholder')}" required>
              </div>
              <div class="input-group">
                <label for="p-icon">${t('parcelas.iconLabel')}</label>
                <select id="p-icon" class="input">
                  ${FI_CATEGORIES.map(c => `<option value="${c}">${escapeHtml(fiCategoryLabel(c))}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="grid-2" style="margin-bottom:12px;">
              <div class="input-group">
                <label for="p-total">${t('parcelas.totalValueLabel')}</label>
                <input type="number" id="p-total" class="input" placeholder="${t('parcelas.totalValuePlaceholder')}" min="0" step="100" required>
              </div>
              <div class="input-group">
                <label for="p-installments">${t('parcelas.installmentsLabel')}</label>
                <input type="number" id="p-installments" class="input" placeholder="${t('parcelas.installmentsPlaceholder')}" min="1" max="600" required>
              </div>
            </div>
            <div class="grid-2" style="margin-bottom:8px;">
              <div class="input-group">
                <label for="p-responsible">${t('parcelas.responsibleLabel')}</label>
                <select id="p-responsible" class="input">
                  <option value="${user.id}">${t('common.me')}</option>
                  ${partner ? `<option value="${partner.user_id}">${escapeHtml(partner.name || t('common.partnerFallback'))}</option>` : ''}
                </select>
              </div>
              <div class="input-group">
                <label for="p-division">${t('common.division')}</label>
                <select id="p-division" class="input">
                  <option value="50/50">${divisionLabel('50/50')}</option>
                  <option value="proporcional" selected>${divisionLabel('proporcional')}</option>
                  <option value="individual">${divisionLabel('individual')}</option>
                </select>
              </div>
            </div>
            <div id="p-error" class="form-error" style="margin-bottom:12px;display:none"></div>
            <div class="modal-actions">
              <button type="button" class="btn btn-outline" id="p-cancel-btn">${t('common.cancel')}</button>
              <button type="submit" class="btn btn-primary" id="p-submit-btn">${t('common.save')}</button>
            </div>
          </form>
        </div>
      </dialog>
    `;

    const modal = document.getElementById('parcela-modal');

    document.getElementById('new-parcela-btn').addEventListener('click', () => modal.showModal());
    document.getElementById('p-cancel-btn').addEventListener('click', () => modal.close());
    modal.addEventListener('pointerdown', (e) => { if (e.target === modal) modal.close(); });

    document.getElementById('parcela-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorDiv = document.getElementById('p-error');
      errorDiv.style.display = 'none';

      const total = Number(document.getElementById('p-total').value);
      const installments = Number(document.getElementById('p-installments').value);
      const name = document.getElementById('p-name').value.trim();

      if (!name) { errorDiv.textContent = t('common.nameRequired'); errorDiv.style.display = 'block'; return; }
      if (!Number.isFinite(total) || total <= 0) { errorDiv.textContent = tError('invalid_total_value'); errorDiv.style.display = 'block'; return; }
      if (!installments || installments < 1) { errorDiv.textContent = tError('invalid_installment_count'); errorDiv.style.display = 'block'; return; }

      const btn = document.getElementById('p-submit-btn');
      btn.disabled = true;
      btn.textContent = t('common.saving');

      try {
        await createParcela({
          name,
          total_value: total,
          total_installments: installments,
          responsible: document.getElementById('p-responsible').value,
          division_type: document.getElementById('p-division').value,
          icon: document.getElementById('p-icon').value,
        });
        modal.close();
        showToast(t('parcelas.addedToast'), 'success');
        parcelasPage();
      } catch (err) {
        errorDiv.textContent = tError(err);
        errorDiv.style.display = 'block';
        btn.disabled = false;
        btn.textContent = t('common.save');
      }
    });

    document.querySelectorAll('.pay-parcela-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: t('parcelas.payTitle'), message: t('parcelas.payMessage'), confirmLabel: t('parcelas.payLabel') });
        if (!ok) return;
        try {
          await payInstallment(btn.dataset.parcelaId);
          showToast(t('parcelas.paidToast'), 'success');
          parcelasPage();
        } catch (err) { showToast(tError(err), 'error'); }
      });
    });

    document.querySelectorAll('.del-parcela-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: t('parcelas.deleteTitle'), message: t('parcelas.deleteMessage'), confirmLabel: t('common.delete'), danger: true });
        if (!ok) return;
        try {
          await deleteParcela(btn.dataset.parcelaId);
          showToast(t('parcelas.deletedToast'), 'info');
          parcelasPage();
        } catch (err) { showToast(tError(err), 'error'); }
      });
    });

  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="ph ph-warning-circle" style="font-size:2rem;color:var(--danger);"></i></div><div class="empty-state-title">${escapeHtml(tError(err))}</div></div>`;
  } finally {
    enhanceAccessibility(app);
  }
}
