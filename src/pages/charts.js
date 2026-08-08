/* juntos — Charts: gastos por ciclo (12 ciclos) e por categoria (ciclo atual) */

import { store } from '../store.js';
import { loadTransactions, getCategoryIcon, CATEGORY_COLORS } from '../services/transaction.js';
import { getMembers } from '../services/household.js';
import { renderAppLayout } from './_layout.js';
import { dateKeyInPeriod, getCurrentReportingPeriod, getReportingPeriods } from '../services/reporting-period.js';
import { escapeHtml, formatCurrency } from './_helpers.js';
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
    const [transactions] = await Promise.all([loadTransactions(), getMembers()]);

    const now = new Date();
    const closingDay = store.state.household?.closing_day ?? 5;
    const currentPeriod = getCurrentReportingPeriod(now, closingDay);

    // Últimos 12 ciclos, respeitando o fechamento configurado pelo lar.
    const monthlyData = getReportingPeriods(now, closingDay, 12).map(period => {
      const d = period.end;
      const monthTxs = transactions.filter(tx => dateKeyInPeriod(tx.date, period));
      const total = monthTxs.reduce((s, tx) => s + Number(tx.amount), 0);
      return {
        key: period.endKey.slice(0, 7),
        label: monthLabel(d, locale),
        total,
        year: d.getFullYear(),
      };
    });

    const maxMonthly = Math.max(...monthlyData.map(d => d.total), 1);

    // Categorias no ciclo atual
    const currentTxs = transactions.filter(tx => dateKeyInPeriod(tx.date, currentPeriod));
    const catTotals = {};
    currentTxs.forEach(tx => {
      const cat = tx.category || 'outros';
      catTotals[cat] = (catTotals[cat] || 0) + Number(tx.amount);
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
          <div class="chart-bar-container">
            ${monthlyData.map(m => {
              const pct = maxMonthly > 0 ? (m.total / maxMonthly) * 100 : 0;
              return `
                <div class="chart-bar-wrapper">
                  <span class="chart-bar-value">${m.total > 0 ? formatCurrency(m.total) : ''}</span>
                  <div class="chart-bar" style="height:${Math.max(pct, 4)}%"></div>
                  <span class="chart-bar-label">${m.label}/${String(m.year).slice(2)}</span>
                </div>
              `;
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
