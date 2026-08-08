/* ══════════════════════════════════════════════
   juntos.cash — Dashboard Page
   ══════════════════════════════════════════════ */

import { store } from '../store.js';
import { loadTransactions, getCategoryIcon, CATEGORY_COLORS } from '../services/transaction.js';
import { loadParcelas } from '../services/parcela.js';
import { getMembers } from '../services/household.js';
import { renderAppLayout } from './_layout.js';
import { getProjectedInstallmentValue } from '../services/calculadora.js';
import { dateKeyInPeriod, formatReportingPeriod, getCurrentReportingPeriod } from '../services/reporting-period.js';
import { escapeHtml, formatCurrency, formatDate } from './_helpers.js';
import { t, tError, categoryLabel, getLangPref } from '../i18n/index.js';

export default async function dashboardPage() {
  const app = document.getElementById('app');
  document.body.className = '';
  renderAppLayout('dashboard');

  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="loading-screen"><div class="spinner"></div><span>${t('common.loading')}</span></div>`;

  try {
    const [transactions, members, parcelas] = await Promise.all([
      loadTransactions(),
      getMembers(),
      loadParcelas(),
    ]);

    const state = store.state;
    const user = state.user;
    const now = new Date();
    const period = getCurrentReportingPeriod(now, state.household?.closing_day ?? 5);
    const monthName = formatReportingPeriod(period, getLangPref());

    // O ciclo respeita o dia de fechamento configurado no lar.
    const monthTxs = transactions.filter(tx => dateKeyInPeriod(tx.date, period));

    const monthParcelas = parcelas
      .filter(p => p.paid_installments < p.total_installments)
      .map(p => ({ ...p, installment_value: getProjectedInstallmentValue(p) }));
    const paInstallments = monthParcelas.reduce((sum, p) => sum + Number(p.installment_value || 0), 0);

    const totalInstallmentsValue = paInstallments;

    const totalTransactions = monthTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalMonth = totalTransactions + totalInstallmentsValue;

    // Calculate per-partner breakdown (individual = só para quem pagou)
    const me = members.find(m => m.user_id === user.id);
    const partner = members.find(m => m.user_id !== user.id);

  const actualPayer = (tx) => tx.paid_by_manual || tx.paid_by;
  const myPaid = monthTxs.filter(tx => actualPayer(tx) === user.id).reduce((s, tx) => s + Number(tx.amount), 0);
  const partnerPaid = monthTxs.filter(tx => actualPayer(tx) !== user.id).reduce((s, tx) => s + Number(tx.amount), 0);

    // Parcela contributions
    const paMyPaid = monthParcelas.filter(p => p.responsible === user.id).reduce((s, p) => s + Number(p.installment_value || 0), 0);
    const paPartnerPaid = monthParcelas.filter(p => p.responsible !== user.id).reduce((s, p) => s + Number(p.installment_value || 0), 0);
    const totalMyPaid = myPaid + paMyPaid;
    const totalPartnerPaid = partnerPaid + paPartnerPaid;

    // For share calculation, cada split_type usa a regra certa:
    // individual só conta pra quem pagou, equal é 50/50 literal (não por
    // renda), proportional é por renda. Antes disso tudo (equal e
    // proportional) caía no mesmo balde e levava a mesma fórmula de renda
    // — um gasto marcado 50/50 acabava sendo calculado proporcional.
    const equalTxs = monthTxs.filter(tx => tx.split_type === 'equal');
    const totalEqual = equalTxs.reduce((s, tx) => s + Number(tx.amount), 0);
    const proportionalTxs = monthTxs.filter(tx => tx.split_type !== 'individual' && tx.split_type !== 'equal');
    const totalProportional = proportionalTxs.reduce((s, tx) => s + Number(tx.amount), 0);
    const individualMyTxs = monthTxs.filter(tx => tx.split_type === 'individual' && actualPayer(tx) === user.id).reduce((s, tx) => s + Number(tx.amount), 0);
    const individualPartnerTxs = monthTxs.filter(tx => tx.split_type === 'individual' && actualPayer(tx) !== user.id).reduce((s, tx) => s + Number(tx.amount), 0);

    // Shared parcelas — mesma separação
    const equalPa = monthParcelas.filter(p => p.split_type === 'equal');
    const totalEqualPa = equalPa.reduce((s, p) => s + Number(p.installment_value || 0), 0);
    const proportionalPa = monthParcelas.filter(p => p.split_type !== 'individual' && p.split_type !== 'equal');
    const totalProportionalPa = proportionalPa.reduce((s, p) => s + Number(p.installment_value || 0), 0);
    const individualMyPa = monthParcelas.filter(p => p.split_type === 'individual' && p.responsible === user.id).reduce((s, p) => s + Number(p.installment_value || 0), 0);
    const individualPartnerPa = monthParcelas.filter(p => p.split_type === 'individual' && p.responsible !== user.id).reduce((s, p) => s + Number(p.installment_value || 0), 0);

    const totalEqualAll = totalEqual + totalEqualPa;
    const totalProportionalAll = totalProportional + totalProportionalPa;
    const totalIndividualMy = individualMyTxs + individualMyPa;
    const totalIndividualPartner = individualPartnerTxs + individualPartnerPa;

    const myIncome = Number(me?.monthly_income) || 0;
    const partnerIncome = Number(partner?.monthly_income) || 0;
    const totalIncome = myIncome + partnerIncome;

    // What each should pay: metade do que é 50/50, fatia por renda do que
    // é proporcional (ou metade se ninguém tem renda cadastrada), e tudo
    // do que é individual e a pessoa pagou.
    const myShare = (totalEqualAll / 2)
      + (totalIncome > 0 ? (myIncome / totalIncome) * totalProportionalAll : totalProportionalAll / 2)
      + totalIndividualMy;
    const partnerShare = (totalEqualAll / 2)
      + (totalIncome > 0 ? (partnerIncome / totalIncome) * totalProportionalAll : totalProportionalAll / 2)
      + totalIndividualPartner;

    const myBalance = totalMyPaid - myShare;
    const partnerBalance = totalPartnerPaid - partnerShare;

    // Top 5 categories
    const catTotals = {};
    monthTxs.forEach(tx => {
      const cat = tx.category || 'outros';
      catTotals[cat] = (catTotals[cat] || 0) + Number(tx.amount);
    });
    const topCategories = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const maxCatValue = topCategories.length > 0 ? topCategories[0][1] : 1;

    // Last 5 transactions
    const recentTxs = transactions.slice(0, 5);

    const totalBarWidth = totalMonth > 0 ? Math.min(100, (totalTransactions / totalMonth) * 100) : 0;
    const installmentBarWidth = totalMonth > 0 ? Math.min(100, (totalInstallmentsValue / totalMonth) * 100) : 0;

    const firstName = (me?.name || user?.user_metadata?.name || '').split(' ')[0];

    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${t('dashboard.greeting')}${firstName ? `, ${escapeHtml(firstName)}` : ''} <i class="ph ph-hand-waving" style="color:var(--brand-light);"></i></h1>
          <div class="page-subtitle">${t('dashboard.cycleLabel', { period: monthName })}</div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-label">${t('dashboard.totalMonth')}</span>
            <span class="stat-icon"><i class="ph ph-money"></i></span>
          </div>
          <div class="stat-value">${formatCurrency(totalMonth)}</div>
          <div class="stat-rows">
            <div class="stat-row">
              <span class="stat-row-label">${t('dashboard.expenses')}</span>
              <span class="stat-row-value">${formatCurrency(totalTransactions)}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row-label">${t('dashboard.installments')}</span>
              <span class="stat-row-value">${formatCurrency(totalInstallmentsValue)}</span>
            </div>
            <div class="stat-row stat-row-total">
              <span class="stat-row-label">${t('dashboard.distribution')}</span>
              <span class="stat-row-bars">
                ${totalMonth > 0 ? `
                  <span class="stat-mini-bar"><span style="width:${totalBarWidth}%;background:var(--success);"></span></span>
                  <span class="stat-mini-bar"><span style="width:${installmentBarWidth}%;background:var(--warning);"></span></span>
                ` : '<span class="stat-row-value">—</span>'}
              </span>
            </div>
          </div>
        </div>

        ${me ? `
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-label">${t('common.youWithName', { name: escapeHtml(me.name || t('common.you')) })}</span>
            <span class="stat-icon"><i class="ph ph-user"></i></span>
          </div>
          <div class="stat-value">${formatCurrency(totalMyPaid)}</div>
          <div class="stat-rows">
            <div class="stat-row">
              <span class="stat-row-label">${t('dashboard.paid')}</span>
              <span class="stat-row-value">${formatCurrency(totalMyPaid)}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row-label">${t('dashboard.shouldPay')}</span>
              <span class="stat-row-value">${formatCurrency(myShare)}</span>
            </div>
            <div class="stat-row stat-row-total">
              <span class="stat-row-label">${t('dashboard.balance')}</span>
              <span class="stat-row-value" style="color:${myBalance >= 0 ? 'var(--success)' : 'var(--danger)'};font-weight:600;">
                ${myBalance >= 0 ? t('dashboard.toReceive') : t('dashboard.toPay')} ${formatCurrency(Math.abs(myBalance))}
              </span>
            </div>
          </div>
        </div>
        ` : ''}

        ${partner ? `
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-label">${escapeHtml(partner.name || t('common.partnerFallback'))}</span>
            <span class="stat-icon"><i class="ph ph-heartbeat"></i></span>
          </div>
          <div class="stat-value">${formatCurrency(totalPartnerPaid)}</div>
          <div class="stat-rows">
            <div class="stat-row">
              <span class="stat-row-label">${t('dashboard.paid')}</span>
              <span class="stat-row-value">${formatCurrency(totalPartnerPaid)}</span>
            </div>
            <div class="stat-row">
              <span class="stat-row-label">${t('dashboard.shouldPay')}</span>
              <span class="stat-row-value">${formatCurrency(partnerShare)}</span>
            </div>
            <div class="stat-row stat-row-total">
              <span class="stat-row-label">${t('dashboard.balance')}</span>
              <span class="stat-row-value" style="color:${partnerBalance >= 0 ? 'var(--success)' : 'var(--danger)'};font-weight:600;">
                ${partnerBalance >= 0 ? t('dashboard.toReceive') : t('dashboard.toPay')} ${formatCurrency(Math.abs(partnerBalance))}
              </span>
            </div>
          </div>
        </div>
        ` : ''}
      </div>

      <div class="dashboard-grid">
        <div class="card-sidebar"><!-- Mobile: aparece primeiro / Desktop: order:2 -->
          ${monthParcelas.length > 0 ? `
          <div class="card">
            <div class="card-header">
              <h3><i class="ph ph-package"></i> ${t('dashboard.activeParcelas')}</h3>
            </div>
              ${monthParcelas.slice(0, 3).map(p => {
                const progress = p.total_installments > 0 ? (p.paid_installments / p.total_installments) * 100 : 0;
                return `
                  <div style="margin-bottom:12px;">
                    <div style="display:flex;justify-content:space-between;font-size:0.8125rem;margin-bottom:4px;">
                      <span style="color:var(--heading-dark)"><i class="ph ph-package"></i> ${escapeHtml(p.name)}</span>
                      <span style="color:var(--muted-dark);font-family:var(--font-mono)">${p.paid_installments}/${p.total_installments}</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-bar-fill ${progress >= 80 ? 'success' : progress >= 50 ? '' : 'warning'}" style="width:${progress}%"></div>
                    </div>
                    <div style="font-size:0.6875rem;color:var(--muted-dark);margin-top:2px;">${formatCurrency(p.installment_value)}${t('common.perMonth')}</div>
                  </div>
                `;
              }).join('')}
              ${monthParcelas.length > 3 ? `<div style="text-align:center;margin-top:8px;"><a href="#/parcelas" style="font-size:0.8125rem;">${t('dashboard.viewAll', { count: monthParcelas.length })}</a></div>` : ''}
            </div>
            ` : ''}

           <div class="card">
             <div class="card-header">
               <h3><i class="ph ph-lightning"></i> ${t('dashboard.shortcuts')}</h3>
             </div>
             <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
               <button class="btn btn-outline btn-block" data-navigate="/transactions">
                 <i class="ph ph-plus"></i> ${t('transactions.new')}
               </button>
               <button class="btn btn-outline btn-block" data-navigate="/parcelas">
                 <i class="ph ph-package"></i> ${t('parcelas.new')}
               </button>
               <button class="btn btn-outline btn-block" data-navigate="/charts">
                 <i class="ph ph-chart-line"></i> ${t('dashboard.viewAnalytics')}
               </button>
             </div>
           </div>
         </div>

         <div><!-- Desktop: ordem natural -->
           ${topCategories.length > 0 ? `
           <div class="card" style="margin-bottom:var(--space-lg);">
             <div class="card-header">
               <h3><i class="ph ph-tag"></i> ${t('dashboard.topCategories')}</h3>
             </div>
             <div class="category-list">
               ${topCategories.map(([cat, val]) => `
                 <div class="category-item">
                   <div class="category-header">
                     <span class="category-name"><i class="ph ph-${getCategoryIcon(cat)}"></i> ${escapeHtml(categoryLabel(cat))}</span>
                     <span class="category-value">${formatCurrency(val)}</span>
                   </div>
                   <div class="category-bar">
                     <div class="category-bar-fill" style="width:${(val / maxCatValue) * 100}%;background:${CATEGORY_COLORS[cat] || 'var(--brand)'}"></div>
                   </div>
                 </div>
               `).join('')}
             </div>
           </div>
           ` : ''}

           ${recentTxs.length > 0 ? `
           <div class="card" style="padding:0">
             <div class="card-header" style="padding:var(--space-xxl) var(--space-xxl) 0;">
               <h3><i class="ph ph-clipboard-text"></i> ${t('dashboard.recentTransactions')}</h3>
             </div>
             <div class="transaction-list">
               ${recentTxs.map(tx => `
                 <div class="transaction-item" style="border-radius:0;border:none;border-bottom:1px solid var(--border-dark)">
                   <div class="transaction-icon" style="background:var(--surface-dark)">
                     <i class="ph ph-${getCategoryIcon(tx.category)}"></i>
                   </div>
                   <div class="transaction-info">
                     <div class="transaction-desc">${escapeHtml(tx.description)}</div>
                     <div class="transaction-meta">
                       <span>${formatDate(tx.date)}</span>
                       <span class="badge badge-brand">${tx.split_type === 'equal' ? `<i class="ph ph-equalizer"></i> ${t('division.badge.equal')}` : tx.split_type === 'proportional' ? `<i class="ph ph-chart-pie"></i> ${t('division.badge.proportional')}` : `<i class="ph ph-user"></i> ${t('division.badge.individual')}`}</span>
                     </div>
                   </div>
                   <div class="transaction-amount">${formatCurrency(tx.amount)}</div>
                 </div>
               `).join('')}
             </div>
           </div>
           ` : `
           <div class="card">
             <div class="card-header">
               <h3><i class="ph ph-clipboard-text"></i> ${t('dashboard.recentTransactions')}</h3>
             </div>
             <div class="empty-state">
               <div class="empty-state-icon"><i class="ph ph-tray" style="font-size:2rem;"></i></div>
               <div class="empty-state-title">${t('dashboard.noTransactionsTitle')}</div>
               <div class="empty-state-text">${t('dashboard.noTransactionsText')}</div>
             </div>
           </div>
           `}
         </div>
       </div>
     `;

  } catch (err) {
    console.error('Dashboard error:', err);
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="ph ph-warning-circle" style="font-size:2rem;color:var(--danger);"></i></div>
      <div class="empty-state-title">${t('dashboard.errorTitle')}</div>
      <div class="empty-state-text">${escapeHtml(tError(err))}</div>
        <button class="btn btn-outline mt-xxl" data-navigate="/dashboard">${t('common.retry')}</button>
      </div>
    `;
  }
}
