/* juntos — Charts: histórico fechado, ciclo atual, projeção e categorias */

import { store } from '../store.js';
import { loadTransactions, getCategoryIcon, CATEGORY_COLORS } from '../services/transaction.js';
import { loadParcelas } from '../services/parcela.js';
import { renderAppLayout } from './_layout.js';
import { dateKeyInPeriod, getCurrentReportingPeriod, getFutureReportingPeriods, getReportingPeriods } from '../services/reporting-period.js';
import { getProjectedInstallmentValue } from '../services/calculadora.js';
import { escapeHtml, formatCurrency, sumMoney } from './_helpers.js';
import { t, tError, categoryLabel, getLangPref } from '../i18n/index.js';

function monthLabel(date, locale) {
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(date);
}

export default async function chartsPage() {
  const app = document.getElementById('app');
  document.body.className = '';
  renderAppLayout('charts');

  const content = document.getElementById('page-content');
  content.innerHTML = `<div class="loading-screen"><div class="spinner"></div><span>${t('common.loading')}</span></div>`;

  try {
    const locale = getLangPref();
    const [transactions, parcelas] = await Promise.all([loadTransactions(), loadParcelas()]);

    const now = new Date();
    const closingDay = store.state.household?.closing_day ?? 5;
    const currentPeriod = getCurrentReportingPeriod(now, closingDay);

    const actualPayer = (tx) => tx.paid_by_manual || tx.paid_by;
    const visibleTransactions = transactions.filter(tx => tx.split_type !== 'individual' || actualPayer(tx) === store.state.user?.id);
    const visibleParcelas = parcelas
      .filter(p => p.split_type !== 'individual' || p.responsible === store.state.user?.id)
      .map(p => ({ ...p, installment_value: getProjectedInstallmentValue(p) }));
    const paymentRecords = visibleParcelas.flatMap(p => (p.payments || []).map(payment => ({
      ...payment,
      parcelaId: p.id,
    })));
    const cycleActualTotal = (period) => sumMoney(
      visibleTransactions.filter(tx => dateKeyInPeriod(tx.date, period)),
      tx => tx.amount,
    ) + sumMoney(
      paymentRecords.filter(payment => dateKeyInPeriod(String(payment.paid_at || '').slice(0, 10), period)),
      payment => payment.amount,
    );
    const projectedCycleTotal = (offset) => sumMoney(
      visibleParcelas.filter(p => p.paid_installments + offset < p.total_installments),
      p => getProjectedInstallmentValue(p, offset),
    );
    const closedPeriods = getReportingPeriods(now, closingDay, 13)
      .filter(period => period.end < currentPeriod.start)
      .slice(-12);
    const futurePeriods = getFutureReportingPeriods(now, closingDay, 6);
    const toChartPoint = (period, status, projectedOffset = null) => {
      const d = period.end;
      return {
        key: period.endKey,
        label: monthLabel(d, locale),
        total: projectedOffset === null ? cycleActualTotal(period) : projectedCycleTotal(projectedOffset),
        year: d.getFullYear(),
        status,
      };
    };
    const historyData = closedPeriods.map(period => toChartPoint(period, 'history'));
    const currentData = [toChartPoint(currentPeriod, 'current')];
    const futureData = futurePeriods.map((period, index) => toChartPoint(period, 'future', index));
    const maxMonthly = Math.max(...historyData.concat(currentData, futureData).map(d => d.total), 1);

    // Categorias no ciclo atual
    const currentTxs = visibleTransactions.filter(tx => dateKeyInPeriod(tx.date, currentPeriod));
    const catTotals = {};
    currentTxs.forEach(tx => {
      const cat = tx.category || 'outros';
      catTotals[cat] = (catTotals[cat] || 0) + sumMoney([tx], item => item.amount);
    });
    const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const maxCat = catEntries.length > 0 ? catEntries[0][1] : 1;
    const totalCurrent = catEntries.reduce((s, [, v]) => s + v, 0);

    content.innerHTML = `
      <div class="page-header">
        <div>
          <h1><i class="ph ph-chart-line"></i> ${t('charts.title')}</h1>
          <div class="page-subtitle">${t('charts.subtitle')}</div>
        </div>
      </div>

      <div class="chart-section">
        <h2><i class="ph ph-chart-bar"></i> ${t('charts.expensesByPeriod')}</h2>
        <div class="card">
          <div class="chart-legend" aria-label="${t('charts.periodLegend')}" style="display:flex;flex-wrap:wrap;gap:var(--space-md);margin-bottom:var(--space-lg);font-size:0.75rem;color:var(--muted-dark);">
            <span><b style="color:var(--muted-dark);">●</b> ${t('charts.closedHistory')}</span>
            <span><b style="color:var(--brand-light);">●</b> ${t('charts.currentCycle')}</span>
            <span><b style="color:var(--warning);">●</b> ${t('charts.futureProjection')}</span>
          </div>
          <h3 class="chart-subtitle">${t('charts.historyTitle')}</h3>
          <div class="chart-bar-container">
            ${historyData.map(m => {
              const pct = maxMonthly > 0 ? (m.total / maxMonthly) * 100 : 0;
              return `<div class="chart-bar-wrapper"><span class="chart-bar-value">${m.total > 0 ? formatCurrency(m.total) : ''}</span><div class="chart-bar chart-bar-history" style="height:${Math.max(pct, 4)}%"></div><span class="chart-bar-label">${m.label}/${String(m.year).slice(2)}</span></div>`;
            }).join('')}
          </div>
          <h3 class="chart-subtitle">${t('charts.projectionTitle')}</h3>
          <div class="chart-bar-container">
            ${currentData.concat(futureData).map(m => {
              const pct = maxMonthly > 0 ? (m.total / maxMonthly) * 100 : 0;
              return `<div class="chart-bar-wrapper"><span class="chart-bar-value">${m.total > 0 ? formatCurrency(m.total) : ''}</span><div class="chart-bar chart-bar-${m.status}" style="height:${Math.max(pct, 4)}%"></div><span class="chart-bar-label">${m.label}/${String(m.year).slice(2)}</span></div>`;
            }).join('')}
          </div>
        </div>
      </div>

      ${catEntries.length > 0 ? `
      <div class="chart-section">
        <h2><i class="ph ph-tag"></i> ${t('charts.expensesByCategory')}</h2>
        <div class="card">
          <div class="category-list">
            ${catEntries.map(([cat, val]) => {
              const pct = totalCurrent > 0 ? (val / totalCurrent) * 100 : 0;
              return `
                <div class="category-item">
                  <div class="category-header">
                    <span class="category-name"><i class="ph ph-${getCategoryIcon(cat)}"></i> ${escapeHtml(categoryLabel(cat))}</span>
                    <span class="category-value">${formatCurrency(val)} <span style="color:var(--muted-dark);font-weight:400;">(${pct.toFixed(1)}%)</span></span>
                  </div>
                  <div class="category-bar">
                    <div class="category-bar-fill" style="width:${(val / maxCat) * 100}%;background:${CATEGORY_COLORS[cat] || 'var(--brand)'}"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
      ` : ''}

      ${catEntries.length === 0 ? `
      <div class="chart-section">
        <h2><i class="ph ph-tag"></i> ${t('charts.expensesByCategory')}</h2>
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon"><i class="ph ph-tray" style="font-size:2rem;"></i></div>
            <div class="empty-state-title">${t('charts.noDataTitle')}</div>
            <div class="empty-state-text">${t('charts.noDataText')}</div>
          </div>
        </div>
      </div>
      ` : ''}
    `;

  } catch (err) {
    console.error('Charts error:', err);
    content.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><i class="ph ph-warning-circle" style="font-size:2rem;color:var(--danger);"></i></div><div class="empty-state-title">${escapeHtml(tError(err))}</div></div>`;
  }
}
