/* ══════════════════════════════════════════════
   juntos.cash — Transactions Page
   ══════════════════════════════════════════════ */

import { store } from '../store.js';
import { loadTransactions, createTransaction, updateTransaction, deleteTransaction, CATEGORIES, getCategoryIcon, DIVISION_TYPES, splitTypeToDivision } from '../services/transaction.js';
import { getMembers } from '../services/household.js';
import { renderAppLayout } from './_layout.js';
import { enhanceAccessibility } from '../components/Accessibility.js';
import { escapeHtml, formatCurrency, formatDate } from './_helpers.js';
import { showToast } from '../components/Toast.js';
import { localDateKey } from '../services/reporting-period.js';
import { confirmDialog } from '../components/Confirm.js';
import { t, tError, categoryLabel, divisionLabel, getLangPref } from '../i18n/index.js';

function monthYearLabel(key, locale) {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
}

export default async function transactionsPage() {
  const app = document.getElementById('app');
  document.body.className = '';
  renderAppLayout('transactions');

  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="loading-screen"><div class="spinner"></div><span>${t('common.loading')}</span></div>`;

  try {
    const [transactions, members] = await Promise.all([
      loadTransactions(),
      getMembers(),
    ]);

    const user = store.state.user;
    const partner = members.find(m => m.user_id !== user.id);

    renderTransactions(transactions, members, user, partner, content);
  } catch (err) {
    content.innerHTML = `      <div class="empty-state"><div class="empty-state-icon"><i class="ph ph-warning-circle" style="font-size:2rem;color:var(--danger);"></i></div><div class="empty-state-title">${escapeHtml(tError(err))}</div></div>`;
  } finally {
    enhanceAccessibility(app);
  }
}

function renderTransactions(transactions, members, user, partner, content) {
  let editingId = null;
  const locale = getLangPref();

  const actualPayer = (tx) => tx.paid_by_manual || tx.paid_by;

  // ── Filtros ──
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthKeys = [...new Set(transactions.map(tx => (tx.date || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  if (!monthKeys.includes(currentMonthKey)) monthKeys.unshift(currentMonthKey);

  const filters = { month: 'all', payer: 'all', search: '' };

  function monthLabel(key) {
    return monthYearLabel(key, locale);
  }

  function applyFilters() {
    return transactions.filter(tx => {
      if (filters.month !== 'all' && !(tx.date || '').startsWith(filters.month)) return false;
      if (filters.payer === 'me' && actualPayer(tx) !== user.id) return false;
      if (filters.payer === 'partner' && actualPayer(tx) === user.id) return false;
      if (filters.search && !tx.description.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h1><i class="ph ph-credit-card"></i> ${t('nav.transactions')}</h1>
        <div class="page-subtitle" id="tx-subtitle"></div>
      </div>
      <button class="btn btn-primary" id="new-tx-btn"><i class="ph ph-plus"></i> ${t('transactions.new')}</button>
    </div>

    <div class="tx-toolbar">
      <select class="input tx-filter-month" id="tx-filter-month">
        <option value="all">${t('transactions.filterAllMonths')}</option>
        ${monthKeys.map(k => `<option value="${k}">${monthLabel(k)}</option>`).join('')}
      </select>
      <select class="input tx-filter-payer" id="tx-filter-payer">
        <option value="all">${t('transactions.filterAll')}</option>
        <option value="me">${t('common.you')}</option>
        ${partner ? `<option value="partner">${escapeHtml(partner.name || t('common.partnerFallback'))}</option>` : ''}
      </select>
      <div class="tx-search-wrap">
        <i class="ph ph-magnifying-glass"></i>
        <input type="text" class="input" id="tx-filter-search" placeholder="${t('transactions.searchPlaceholder')}">
      </div>
    </div>

    <div id="tx-list-wrap"></div>

    <!-- Modal -->
    <dialog id="tx-modal" class="modal-overlay">
      <div class="modal">
        <h2 id="tx-modal-title">${t('transactions.new')}</h2>
        <form id="tx-form">
          <input type="hidden" id="tx-edit-id" value="">
          <div class="input-group" style="margin-bottom:16px">
            <label for="tx-desc">${t('transactions.descLabel')}</label>
            <input type="text" id="tx-desc" class="input" placeholder="${t('transactions.descPlaceholder')}" required>
          </div>
          <div class="input-group" style="margin-bottom:16px">
            <label for="tx-amount">${t('transactions.amountLabel')}</label>
            <input type="number" id="tx-amount" class="input" placeholder="${t('transactions.amountPlaceholder')}" min="0" step="0.01" required>
          </div>
          <div class="grid-2" style="margin-bottom:16px">
            <div class="input-group">
              <label for="tx-category">${t('common.category')}</label>
              <select id="tx-category" class="input">
                ${CATEGORIES.map(c => `<option value="${c}">${escapeHtml(categoryLabel(c))}</option>`).join('')}
              </select>
            </div>
            <div class="input-group">
              <label for="tx-division">${t('common.division')}</label>
              <select id="tx-division" class="input">
                ${DIVISION_TYPES.map(d => `<option value="${d}">${escapeHtml(divisionLabel(d))}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="grid-2" style="margin-bottom:8px">
            <div class="input-group">
              <label for="tx-paid-by">${t('transactions.paidByLabel')}</label>
              <select id="tx-paid-by" class="input">
                <option value="${user?.id}">${t('common.me')}</option>
                ${partner ? `<option value="${partner.is_manual ? escapeHtml(partner.name) : partner.user_id}">${escapeHtml(partner.name || t('common.partnerFallback'))}</option>` : ''}
              </select>
              ${!partner ? `<div style="font-size:0.75rem;color:var(--warning);margin-top:4px;"><i class="ph ph-warning-circle"></i> ${t('common.partnerWarning')}</div>` : ''}
            </div>
            <div class="input-group">
              <label for="tx-date">${t('common.date')}</label>
              <input type="date" id="tx-date" class="input" value="${localDateKey()}">
            </div>
          </div>
          <div class="input-group" style="margin-bottom:16px">
            <label for="tx-payment-method">${t('transactions.paymentMethodLabel')}</label>
            <input type="text" id="tx-payment-method" class="input" placeholder="Ex.: Nubank Alexandre (opcional)" maxlength="100">
          </div>
          <div id="tx-error" class="form-error" style="margin-bottom:12px;display:none"></div>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" id="tx-cancel-btn">${t('common.cancel')}</button>
            <button type="submit" class="btn btn-primary" id="tx-submit-btn">${t('common.save')}</button>
          </div>
        </form>
      </div>
    </dialog>
  `;

  const listWrap = document.getElementById('tx-list-wrap');
  const subtitle = document.getElementById('tx-subtitle');

  function renderList() {
    const filtered = applyFilters();
    const total = filtered.reduce((s, tx) => s + Number(tx.amount), 0);
    const isFiltered = filters.month !== 'all' || filters.payer !== 'all' || filters.search;
    subtitle.textContent = `${t('transactions.countLabel', { count: filtered.length })}${isFiltered ? ' ' + t('transactions.inFilter') : ''} · ${formatCurrency(total)}`;

    if (filtered.length === 0) {
      listWrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="ph ph-${isFiltered ? 'magnifying-glass' : 'tray'}" style="font-size:2rem;"></i></div>
          <div class="empty-state-title">${isFiltered ? t('transactions.emptyFilteredTitle') : t('transactions.emptyTitle')}</div>
          <div class="empty-state-text">${isFiltered ? t('transactions.emptyFilteredText') : t('transactions.emptyText')}</div>
        </div>
      `;
      return;
    }

    listWrap.innerHTML = `
      <div class="card" style="padding:0;">
        <div class="transaction-list">
          ${filtered.map(tx => {
            const isMine = actualPayer(tx) === user.id;
            const payer = isMine ? t('common.you') : (partner?.name || t('common.partnerFallback'));
            const divLabel = t('division.badge.' + (tx.split_type || 'equal'));
            const pmName = tx.payment_method || '';
            return `
              <div class="transaction-item" data-tx-id="${tx.id}" style="border-radius:0;border:none;border-bottom:1px solid var(--border-dark)">
                <div class="transaction-icon">
                  <i class="ph ph-${getCategoryIcon(tx.category)}"></i>
                </div>
                <div class="transaction-info">
                  <div class="transaction-desc">${escapeHtml(tx.description)}</div>
                  <div class="transaction-meta">
                    <span>${formatDate(tx.date)}</span>
                    <span class="badge badge-brand">${escapeHtml(divLabel)}</span>
                    <span><i class="ph ph-user"></i> ${escapeHtml(payer)}</span>
                    ${pmName ? `<span class="badge badge-brand" style="background:var(--surface-dark);color:var(--muted-dark);"><i class="ph ph-credit-card"></i> ${escapeHtml(pmName)}</span>` : ''}
                  </div>
                </div>
                <div class="transaction-amount">${formatCurrency(tx.amount)}</div>
                <div class="tx-actions">
                  <button class="btn btn-ghost btn-sm edit-tx-btn" data-tx-id="${tx.id}" title="${t('common.edit')}"><i class="ph ph-pencil"></i></button>
                  <button class="btn btn-ghost btn-sm del-tx-btn" data-tx-id="${tx.id}" title="${t('common.delete')}"><i class="ph ph-trash"></i></button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Bind row actions
    listWrap.querySelectorAll('.edit-tx-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tx = transactions.find(t => t.id === btn.dataset.txId);
        if (tx) openModal(tx);
      });
    });

    listWrap.querySelectorAll('.del-tx-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.txId;
        const tx = transactions.find(t => t.id === id);
        const ok = await confirmDialog({
          title: t('transactions.deleteTitle'),
          message: tx ? t('transactions.deleteMessage', { desc: tx.description, amount: formatCurrency(tx.amount) }) : t('transactions.deleteMessageGeneric'),
          confirmLabel: t('common.delete'),
          danger: true,
        });
        if (!ok) return;
        try {
          await deleteTransaction(id);
          showToast(t('transactions.deletedToast'), 'info');
          transactionsPage();
        } catch (err) {
          showToast(tError(err), 'error');
        }
      });
    });
  }

  renderList();

  // Filter events
  document.getElementById('tx-filter-month').addEventListener('change', (e) => {
    filters.month = e.target.value;
    renderList();
  });
  document.getElementById('tx-filter-payer').addEventListener('change', (e) => {
    filters.payer = e.target.value;
    renderList();
  });
  document.getElementById('tx-filter-search').addEventListener('input', (e) => {
    filters.search = e.target.value.trim();
    renderList();
  });

  let submitting = false;

  function openModal(tx) {
    const modal = document.getElementById('tx-modal');
    const title = document.getElementById('tx-modal-title');
    const editId = document.getElementById('tx-edit-id');

    if (tx) {
      editingId = tx.id;
      title.textContent = t('transactions.modalTitleEdit');
      editId.value = tx.id;
      document.getElementById('tx-desc').value = tx.description;
      document.getElementById('tx-amount').value = tx.amount;
      document.getElementById('tx-category').value = tx.category || 'outros';
      document.getElementById('tx-division').value = splitTypeToDivision(tx.split_type);
      document.getElementById('tx-paid-by').value = tx.paid_by_manual || tx.paid_by || user.id;
      document.getElementById('tx-date').value = tx.date || localDateKey();
      document.getElementById('tx-payment-method').value = tx.payment_method || '';
    } else {
      editingId = null;
      title.textContent = t('transactions.new');
      editId.value = '';
      document.getElementById('tx-desc').value = '';
      document.getElementById('tx-amount').value = '';
      document.getElementById('tx-category').value = 'alimentação';
      document.getElementById('tx-division').value = 'proporcional';
      document.getElementById('tx-paid-by').value = user.id;
      document.getElementById('tx-date').value = localDateKey();
      document.getElementById('tx-payment-method').value = '';
    }
    submitting = false;
    modal.showModal();
    document.getElementById('tx-error').style.display = 'none';
  }

  document.getElementById('new-tx-btn').addEventListener('click', () => openModal(null));

  document.getElementById('tx-cancel-btn').addEventListener('click', () => {
    document.getElementById('tx-modal').close();
  });

  document.getElementById('tx-modal').addEventListener('pointerdown', (e) => {
    if (e.target === e.currentTarget) {
      document.getElementById('tx-modal').close();
    }
  });

  document.getElementById('tx-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitting) return;
    submitting = true;
    const errorDiv = document.getElementById('tx-error');
    errorDiv.style.display = 'none';

    const data = {
      description: document.getElementById('tx-desc').value.trim(),
      amount: document.getElementById('tx-amount').value,
      category: document.getElementById('tx-category').value,
      division_type: document.getElementById('tx-division').value,
      paid_by: document.getElementById('tx-paid-by').value,
      date: document.getElementById('tx-date').value,
      payment_method: document.getElementById('tx-payment-method').value.trim() || null,
    };

    if (!data.description) { errorDiv.textContent = t('transactions.descRequired'); errorDiv.style.display = 'block'; submitting = false; return; }
    if (!data.amount || Number(data.amount) <= 0) { errorDiv.textContent = t('common.invalidAmount'); errorDiv.style.display = 'block'; submitting = false; return; }

    const btn = document.getElementById('tx-submit-btn');
    btn.disabled = true;
    btn.textContent = t('common.saving');

    try {
      const editId = document.getElementById('tx-edit-id').value;
      if (editId) {
        await updateTransaction(editId, data);
        showToast(t('transactions.updatedToast'), 'success');
      } else {
        await createTransaction(data);
        showToast(t('transactions.createdToast'), 'success');
      }
      document.getElementById('tx-modal').close();
      transactionsPage();
    } catch (err) {
      errorDiv.textContent = tError(err);
      errorDiv.style.display = 'block';
      btn.disabled = false;
      btn.textContent = t('common.save');
      submitting = false;
    }
  });
}
