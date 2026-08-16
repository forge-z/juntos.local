/* ══════════════════════════════════════════════
   juntos.cash — Settings Page
   Setores: Perfil · Parceiro · Lar · Aparência · Ajuda
   ══════════════════════════════════════════════ */

import { store } from '../store.js';
import { getMembers, updateMemberIncome, updateHousehold } from '../services/household.js';
import { renderAppLayout } from './_layout.js';
import { enhanceAccessibility } from '../components/Accessibility.js';
import { showToast } from '../components/Toast.js';
import { confirmDialog } from '../components/Confirm.js';
import { navigate } from '../router.js';
import { logout, updatePassword } from '../services/auth.js';
import { exportHistoryCSV } from '../services/export.js';
import { escapeHtml, formatCurrency } from './_helpers.js';
import { t, tError } from '../i18n/index.js';
import { getTierLabel } from '../services/subscription.js';
import { apiFetch } from '../services/api.js';

// closing_day: 1..31 = dia fixo · 0 = último dia do mês · -1..-5 = nº dia útil
export function closingDayLabel(value) {
  const v = Number(value ?? 5);
  if (v === 0) return t('settings.lastDayOfMonth');
  if (v < 0) return t('settings.nthBusinessDay', { n: -v });
  return t('settings.dayN', { n: v });
}

function bindPasswordChangeForm() {
  document.getElementById('password-change-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = document.getElementById('password-change-error');
    error.style.display = 'none';
    try {
      await updatePassword(document.getElementById('new-password').value, document.getElementById('current-password').value);
      showToast('Senha alterada. Faça login novamente.', 'success');
      await logout();
      navigate('/login');
    } catch (err) {
      error.textContent = tError(err);
      error.style.display = 'block';
    }
  });
}

export default async function settingsPage() {
  const app = document.getElementById('app');
  document.body.className = '';
  renderAppLayout('settings');

  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="loading-screen"><div class="spinner"></div><span>${t('common.loading')}</span></div>`;

  try {
    const user = store.state.user;

    // A temporary member may only change their password. The API deliberately
    // returns 428 for household reads in this state, so render this form before
    // attempting to load members or any other household data.
    if (user?.must_change_password) {
      content.innerHTML = `
        <div class="page-header">
          <div>
            <h1><i class="ph ph-lock-key"></i> Primeiro acesso</h1>
            <div class="page-subtitle">Defina uma nova senha para continuar.</div>
          </div>
        </div>
        <div class="settings-section">
          <div class="card">
            <p class="page-subtitle" style="margin-bottom:var(--space-lg);">A senha provisória deve ser substituída antes de acessar os dados do lar.</p>
            <form id="password-change-form" style="display:flex;gap:var(--space-sm);flex-wrap:wrap;align-items:end;">
              <div class="input-group"><label for="current-password">Senha provisória</label><input class="input" id="current-password" type="password" autocomplete="current-password" required></div>
              <div class="input-group"><label for="new-password">Nova senha</label><input class="input" id="new-password" type="password" minlength="12" autocomplete="new-password" required></div>
              <button class="btn btn-primary" type="submit">Definir senha</button>
            </form>
            <div id="password-change-error" class="form-error" style="display:none;margin-top:var(--space-sm)"></div>
          </div>
        </div>
        <div class="settings-section"><button class="btn btn-danger-outline btn-block" id="settings-logout-btn"><i class="ph ph-sign-out"></i> ${t('nav.logout')}</button></div>
      `;
      bindPasswordChangeForm();
      document.getElementById('settings-logout-btn')?.addEventListener('click', async () => {
        await logout();
        navigate('/login');
      });
      return;
    }

    const members = await getMembers();
    const household = store.state.household;
    const me = members.find(m => m.user_id === user.id);

    const name = user?.user_metadata?.name || '';
    const email = user?.email || '';
    const tierLabel = getTierLabel();
    const canExport = true;
    const isAdmin = user?.role === 'admin';


    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1><i class="ph ph-gear"></i> ${t('settings.header')}</h1>
          <div class="page-subtitle">${t('settings.subtitle')}</div>
        </div>
      </div>

      <!-- ── Perfil ── -->
      <div class="settings-section">
        <h3><i class="ph ph-user-circle"></i> ${t('settings.profileSection')}</h3>
        <div class="card">
          <div class="settings-row">
            <span class="settings-label">${t('common.name')}</span>
            <span class="settings-value">${escapeHtml(name) || '—'}</span>
          </div>
          <div class="settings-row">
            <span class="settings-label">${t('common.email')}</span>
            <span class="settings-value">${escapeHtml(email)}</span>
          </div>
          <div class="settings-row">
            <span class="settings-label">${t('settings.monthlyIncome')}</span>
            <div class="settings-input-inline">
              <span class="settings-value" style="margin-right:8px;">${me?.monthly_income !== null && me?.monthly_income !== undefined ? formatCurrency(me.monthly_income) : t('settings.notDefined')}</span>
              <button class="btn btn-outline btn-sm" id="edit-income-btn"><i class="ph ph-pencil"></i> ${t('common.change')}</button>
            </div>
          </div>
          <div class="settings-row">
            <span class="settings-label">${t('settings.plan')}</span>
            <div class="settings-input-inline">
              <span class="badge badge-brand settings-value" id="current-tier-label"><i class="ph ph-crown"></i> ${tierLabel}</span>
              <span class="badge badge-brand settings-value">Local completo</span>
            </div>
          </div>
          <div class="settings-row">
            <span class="settings-label">${t('settings.exportData')}</span>
            <div class="settings-input-inline">
              <button class="btn btn-outline btn-sm" id="export-data-btn"><i class="ph ph-download-simple"></i> ${t('settings.exportBtn')}</button>
            </div>
          </div>
        </div>
      </div>

      ${isAdmin ? `
      <!-- ── API do agente ── -->
      <div class="settings-section">
        <h3><i class="ph ph-robot"></i> API do agente</h3>
        <div class="card">
          <p class="page-subtitle">Um único token permite agentes (MCP ou API) registrarem despesas no lar. O segredo aparece uma única vez.</p>
          <div id="agent-token-status" style="margin:var(--space-md) 0;"></div>
          <div id="api-key-secret" class="form-success" style="display:none;word-break:break-all;"></div>
        </div>
      </div>` : ''}

      <!-- ── Senha local ── -->
      <div class="settings-section">
        <h3><i class="ph ph-lock"></i> Senha</h3>
        <div class="card"><form id="password-change-form" style="display:flex;gap:var(--space-sm);flex-wrap:wrap;align-items:end;">
          <div class="input-group"><label for="current-password">Senha atual</label><input class="input" id="current-password" type="password" required></div>
          <div class="input-group"><label for="new-password">Nova senha</label><input class="input" id="new-password" type="password" minlength="12" required></div>
          <button class="btn btn-outline" type="submit">Alterar senha</button>
        </form><div id="password-change-error" class="form-error" style="display:none;margin-top:var(--space-sm)"></div></div>
      </div>

      <!-- ── Lar ── -->
      ${household ? `
      <div class="settings-section">
        <h3><i class="ph ph-house-line"></i> ${t('settings.householdSection')}</h3>
        <div class="card">
          <div class="settings-row">
            <span class="settings-label">${t('settings.householdName')}</span>
            <div class="settings-input-inline">
              <span class="settings-value">${escapeHtml(household.name)}</span>
              <button class="btn btn-outline btn-sm" id="edit-household-name-btn"><i class="ph ph-pencil"></i> ${t('common.change')}</button>
            </div>
          </div>
          <div class="settings-row">
            <span class="settings-label">${t('settings.closingDay')}</span>
            <div class="settings-input-inline">
              <span class="settings-value">${closingDayLabel(household.closing_day)}</span>
              <button class="btn btn-outline btn-sm" id="edit-closing-day-btn"><i class="ph ph-pencil"></i> ${t('common.change')}</button>
            </div>
          </div>
          <div class="settings-row">
            <div>
              <div class="settings-label">${t('settings.autoPayInstallments')}</div>
              <div class="settings-help">${t('settings.autoPayInstallmentsHelp')}</div>
            </div>
            <label class="toggle-control">
              <input type="checkbox" id="auto-pay-installments" aria-label="${t('settings.autoPayInstallments')}" ${household.auto_pay_installments ? 'checked' : ''}>
              <span class="toggle-slider" aria-hidden="true"></span>
            </label>
          </div>
          <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:var(--space-md);padding:var(--space-lg) 0;">
            <span class="settings-label" style="margin-bottom:4px;">${t('settings.participants')}</span>
            ${members.map(m => {
              const totalIncome = members.reduce((s, x) => s + Number(x.monthly_income || 0), 0);
              const pct = totalIncome > 0 ? ((Number(m.monthly_income || 0) / totalIncome) * 100).toFixed(0) : 0;
              const isMe = m.user_id === user.id;
              return `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface-dark);border-radius:var(--radius-sm);">
                  <div style="display:flex;align-items:center;gap:var(--space-sm);">
                    <span>${isMe ? '<i class="ph ph-user"></i>' : (m.is_manual ? '<i class="ph ph-hand"></i>' : '<i class="ph ph-heartbeat"></i>')}</span>
                    <span style="color:var(--heading-dark);font-weight:500;font-size:0.875rem;">${escapeHtml(m.name || t('layout.defaultUserName'))}</span>
                    ${isMe ? `<span style="font-size:0.6875rem;color:var(--muted-dark);">${t('settings.youTag')}</span>` : ''}
                    ${m.is_manual ? `<span style="font-size:0.6875rem;color:var(--warning);">${t('settings.manualTag')}</span>` : ''}
                  </div>
                  <div style="display:flex;align-items:center;gap:var(--space-lg);font-size:0.8125rem;">
                    <span style="color:var(--body-dark);font-family:var(--font-mono);">${formatCurrency(m.monthly_income || 0)}</span>
                    <span style="color:var(--brand-light);font-weight:600;min-width:40px;text-align:right;">${pct}%</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      ` : ''}

      <div class="settings-section">
        <button class="btn btn-danger-outline btn-block" id="settings-logout-btn"><i class="ph ph-sign-out"></i> ${t('nav.logout')}</button>
      </div>


      <div class="app-footer">
        <button class="app-version-inline" id="app-version-badge" title="${t('settings.newsBadge')}">
          <span>v<span id="app-version-number"></span></span>
          <span class="app-version-dot">•</span>
          <span>${t('settings.newsBadge')}</span>
        </button>
      </div>

      <!-- Changelog Modal -->
      <dialog id="changelog-modal" class="modal-overlay">
        <div class="modal" style="max-width:520px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h2>${t('settings.changelogTitle')}</h2>
            <button class="btn btn-ghost btn-sm" id="changelog-close-btn"><i class="ph ph-x"></i></button>
          </div>
          <div id="changelog-list" style="max-height:60vh;overflow-y:auto;"></div>
        </div>
      </dialog>

      <!-- Income Modal -->
      <dialog id="income-modal" class="modal-overlay">
        <div class="modal">
          <h2>${t('settings.changeIncomeTitle')}</h2>
          <form id="income-form">
            <div class="input-group" style="margin-bottom:8px">
              <label for="income-value">${t('settings.newIncomeLabel')}</label>
            <input type="number" id="income-value" class="input" placeholder="${t('household.incomePlaceholder')}" min="0" step="100" value="${me?.monthly_income ?? ''}">
            </div>
            <div id="income-error" class="form-error" style="margin-bottom:12px;display:none"></div>
            <div class="modal-actions">
              <button type="button" class="btn btn-outline" id="income-cancel-btn">${t('common.cancel')}</button>
              <button type="submit" class="btn btn-primary" id="income-submit-btn">${t('common.save')}</button>
            </div>
          </form>
        </div>
      </dialog>

      <!-- Household Name Modal -->
      <dialog id="household-name-modal" class="modal-overlay">
        <div class="modal">
          <h2>${t('settings.changeHouseholdNameTitle')}</h2>
          <form id="household-name-form">
            <div class="input-group" style="margin-bottom:8px">
              <label for="household-name-value">${t('settings.newNameLabel')}</label>
              <input type="text" id="household-name-value" class="input" placeholder="${t('household.namePlaceholder')}" value="${escapeHtml(household?.name || '')}">
            </div>
            <div id="household-name-error" class="form-error" style="margin-bottom:12px;display:none"></div>
            <div class="modal-actions">
              <button type="button" class="btn btn-outline" id="household-name-cancel-btn">${t('common.cancel')}</button>
              <button type="submit" class="btn btn-primary" id="household-name-submit-btn">${t('common.save')}</button>
            </div>
          </form>
        </div>
      </dialog>

      <!-- Closing Day Modal -->
      <dialog id="closing-day-modal" class="modal-overlay">
        <div class="modal">
          <h2>${t('settings.changeClosingDayTitle')}</h2>
          <p style="font-size:0.8125rem;color:var(--muted-dark);margin-bottom:var(--space-lg);">
            ${t('settings.closingDayHelp')}
          </p>
          <form id="closing-day-form">
            <div class="input-group" style="margin-bottom:8px">
              <label for="closing-day-value">${t('settings.closingDaySelectLabel')}</label>
              <select id="closing-day-value" class="input">
                <optgroup label="${t('settings.specialRules')}">
                  <option value="0">${t('settings.lastDayOfMonth')}</option>
                  <option value="-1">${t('settings.nthBusinessDay', { n: 1 })}</option>
                  <option value="-2">${t('settings.nthBusinessDay', { n: 2 })}</option>
                  <option value="-3">${t('settings.nthBusinessDay', { n: 3 })}</option>
                  <option value="-4">${t('settings.nthBusinessDay', { n: 4 })}</option>
                  <option value="-5">${t('settings.nthBusinessDay', { n: 5 })}</option>
                </optgroup>
                <optgroup label="${t('settings.fixedDayOfMonth')}">
                  ${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${t('settings.dayN', { n: i + 1 })}</option>`).join('')}
                </optgroup>
              </select>
            </div>
            <div id="closing-day-error" class="form-error" style="margin-bottom:12px;display:none"></div>
            <div class="modal-actions">
              <button type="button" class="btn btn-outline" id="closing-day-cancel-btn">${t('common.cancel')}</button>
              <button type="submit" class="btn btn-primary" id="closing-day-submit-btn">${t('common.save')}</button>
            </div>
          </form>
        </div>
      </dialog>

    `;

    // ── Versão + changelog ──
    const { APP_VERSION, CHANGELOG } = await import('../services/changelog.js');
    const versionEl = document.getElementById('app-version-number');
    if (versionEl) versionEl.textContent = APP_VERSION;

    const versionBadge = document.getElementById('app-version-badge');
    const changelogModal = document.getElementById('changelog-modal');
    const changelogList = document.getElementById('changelog-list');

    function renderChangelog() {
      if (!changelogList) return;
      changelogList.innerHTML = CHANGELOG().map(entry => `
        <div style="margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
            <span class="badge badge-brand" style="font-size:0.75rem;">v${entry.version}</span>
            <span style="font-size:0.75rem;color:var(--muted-dark);">${entry.date}</span>
            ${entry.label ? `<span style="font-weight:600;font-size:0.875rem;color:var(--heading-dark);">${escapeHtml(entry.label)}</span>` : ''}
          </div>
          ${entry.fixes?.length ? `
            <div style="margin-bottom:8px;">
              <div style="font-size:0.75rem;font-weight:600;color:var(--success);margin-bottom:4px;"><i class="ph ph-check-circle"></i> ${t('settings.changelogFixes')}</div>
              <ul style="margin:0;padding-left:20px;color:var(--body-dark);font-size:0.8125rem;line-height:1.6;">
                ${entry.fixes.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${entry.features?.length ? `
            <div>
              <div style="font-size:0.75rem;font-weight:600;color:var(--brand-light);margin-bottom:4px;"><i class="ph ph-sparkle"></i> ${t('settings.changelogFeatures')}</div>
              <ul style="margin:0;padding-left:20px;color:var(--body-dark);font-size:0.8125rem;line-height:1.6;">
                ${entry.features.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `).join('');
    }

    if (versionBadge && changelogModal) {
      versionBadge.addEventListener('click', () => {
        renderChangelog();
        changelogModal.showModal();
      });
      document.getElementById('changelog-close-btn')?.addEventListener('click', () => changelogModal.close());
      changelogModal.addEventListener('pointerdown', (e) => {
        if (e.target === changelogModal) changelogModal.close();
      });
    }

    // ── Income edit ──
    document.getElementById('edit-income-btn').addEventListener('click', () => {
      document.getElementById('income-modal').showModal();
    });

    document.getElementById('income-cancel-btn').addEventListener('click', () => {
      document.getElementById('income-modal').close();
    });

    document.getElementById('income-modal').addEventListener('pointerdown', (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('income-modal').close();
      }
    });

    document.getElementById('income-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorDiv = document.getElementById('income-error');
      errorDiv.style.display = 'none';
      const income = document.getElementById('income-value').value;

      if (income === '' || Number.isNaN(Number(income)) || Number(income) < 0) {
        errorDiv.textContent = t('settings.incomeInvalid');
        errorDiv.style.display = 'block';
        return;
      }

      const btn = document.getElementById('income-submit-btn');
      btn.disabled = true;
      btn.textContent = t('common.saving');

      try {
        await updateMemberIncome(user.id, Number(income));
        document.getElementById('income-modal').close();
        showToast(t('settings.incomeUpdatedToast'), 'success');
        settingsPage();
      } catch (err) {
        errorDiv.textContent = tError(err);
        errorDiv.style.display = 'block';
        btn.disabled = false;
        btn.textContent = t('common.save');
      }
    });

    // ── Household name ──
    const hhNameBtn = document.getElementById('edit-household-name-btn');
    if (hhNameBtn) {
      hhNameBtn.addEventListener('click', () => {
        document.getElementById('household-name-modal').showModal();
      });
    }

    document.getElementById('household-name-cancel-btn')?.addEventListener('click', () => {
      document.getElementById('household-name-modal').close();
    });

    document.getElementById('household-name-modal')?.addEventListener('pointerdown', (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('household-name-modal').close();
      }
    });

    document.getElementById('household-name-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorDiv = document.getElementById('household-name-error');
      errorDiv.style.display = 'none';
      const newName = document.getElementById('household-name-value').value.trim();
      if (!newName) {
        errorDiv.textContent = t('common.nameRequired');
        errorDiv.style.display = 'block';
        return;
      }
      const btn = document.getElementById('household-name-submit-btn');
      btn.disabled = true;
      btn.textContent = t('common.saving');
      try {
        await updateHousehold({ name: newName });
        document.getElementById('household-name-modal').close();
        showToast(t('settings.householdNameUpdatedToast'), 'success');
        settingsPage();
      } catch (err) {
        errorDiv.textContent = tError(err);
        errorDiv.style.display = 'block';
        btn.disabled = false;
        btn.textContent = t('common.save');
      }
    });

    // ── Closing day ──
    const closingDayBtn = document.getElementById('edit-closing-day-btn');
    if (closingDayBtn) {
      closingDayBtn.addEventListener('click', () => {
        document.getElementById('closing-day-value').value = String(household?.closing_day ?? 5);
        document.getElementById('closing-day-modal').showModal();
      });
    }

    document.getElementById('closing-day-cancel-btn')?.addEventListener('click', () => {
      document.getElementById('closing-day-modal').close();
    });

    document.getElementById('closing-day-modal')?.addEventListener('pointerdown', (e) => {
      if (e.target === e.currentTarget) {
        document.getElementById('closing-day-modal').close();
      }
    });

    document.getElementById('closing-day-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorDiv = document.getElementById('closing-day-error');
      errorDiv.style.display = 'none';
      const day = Number(document.getElementById('closing-day-value').value);
      if (Number.isNaN(day) || day < -5 || day > 31) {
        errorDiv.textContent = t('settings.invalidOption');
        errorDiv.style.display = 'block';
        return;
      }
      const btn = document.getElementById('closing-day-submit-btn');
      btn.disabled = true;
      btn.textContent = t('common.saving');
      try {
        await updateHousehold({ closing_day: day });
        document.getElementById('closing-day-modal').close();
        showToast(t('settings.closingDayUpdatedToast'), 'success');
        settingsPage();
      } catch (err) {
        errorDiv.textContent = tError(err);
        errorDiv.style.display = 'block';
        btn.disabled = false;
        btn.textContent = t('common.save');
      }
    });

    document.getElementById('auto-pay-installments')?.addEventListener('change', async (event) => {
      const checkbox = event.currentTarget;
      if (checkbox.dataset.saving === 'true') return;
      checkbox.dataset.saving = 'true';
      checkbox.disabled = true;
      try {
        await updateHousehold({ auto_pay_installments: checkbox.checked });
        showToast(t(checkbox.checked ? 'settings.autoPayEnabledToast' : 'settings.autoPayDisabledToast'), 'success');
      } catch (err) {
        checkbox.checked = !checkbox.checked;
        showToast(tError(err), 'error');
      } finally {
        checkbox.disabled = false;
        delete checkbox.dataset.saving;
      }
    });

    // ── Exportar dados (Pro/Premium) ──
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn && canExport) {
      exportBtn.addEventListener('click', async () => {
        exportBtn.disabled = true;
        exportBtn.innerHTML = `<i class="ph ph-spinner"></i> ${t('settings.exporting')}`;
        try {
          await exportHistoryCSV();
          showToast(t('settings.exportedToast'), 'success');
        } catch (err) {
          showToast(tError(err), 'error');
        } finally {
          exportBtn.disabled = false;
          exportBtn.innerHTML = `<i class="ph ph-download-simple"></i> ${t('settings.exportBtn')}`;
        }
      });
    }

    // ── Senha ──
    bindPasswordChangeForm();

    // ── API do agente (token único) ──
    if (isAdmin) {
      const status = document.getElementById('agent-token-status');
      const secret = document.getElementById('api-key-secret');
      const renderToken = async () => {
        const { api_key } = await apiFetch('/admin/api-key');
        if (!api_key) {
          status.innerHTML = `<button class="btn btn-primary" id="create-api-key-btn"><i class="ph ph-plus"></i> Criar token</button>`;
          document.getElementById('create-api-key-btn').addEventListener('click', async () => {
            try {
              const { api_key: created } = await apiFetch('/admin/api-key', { method: 'POST' });
              secret.textContent = `Guarde agora — este token não será exibido novamente: ${created.token}`;
              secret.style.display = 'block';
              await renderToken();
            } catch (error) { showToast(tError(error), 'error'); }
          });
        } else {
          status.innerHTML = `
            <div class="settings-row">
              <span class="settings-label"><i class="ph ph-key"></i> Token ativo: <code>${escapeHtml(api_key.prefix)}…</code> · criado em ${new Date(api_key.created_at).toLocaleDateString('pt-BR')}</span>
              <button class="btn btn-danger-outline btn-sm" id="revoke-api-key-btn"><i class="ph ph-trash"></i> Revogar</button>
            </div>`;
          document.getElementById('revoke-api-key-btn').addEventListener('click', async () => {
            await apiFetch('/admin/api-key', { method: 'DELETE' });
            secret.style.display = 'none';
            showToast('Token revogado.', 'info');
            await renderToken();
          });
        }
      };
      await renderToken();
    }

    // ── Logout ──
    document.getElementById('settings-logout-btn').addEventListener('click', async () => {
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

  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="ph ph-warning-circle" style="font-size:2rem;color:var(--danger);"></i></div><div class="empty-state-title">${escapeHtml(tError(err))}</div></div>`;
  } finally {
    enhanceAccessibility(app);
  }
}
