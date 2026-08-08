/* ══════════════════════════════════════════════
   juntos.cash — Charts Page
   ══════════════════════════════════════════════ */

import { store } from '../store.js';
import { loadTransactions, getCategoryIcon, CATEGORY_COLORS } from '../services/transaction.js';
import { loadParcelas } from '../services/parcela.js';
import { getMembers } from '../services/household.js';
import { renderAppLayout } from './_layout.js';
import { getProjectedInstallmentValue } from '../services/calculadora.js';
import { dateKeyInPeriod, getCurrentReportingPeriod, getReportingPeriods } from '../services/reporting-period.js';
import { calculateContribution } from '../services/balance.js';
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
    const [transactions, members, parcelas] = await Promise.all([
      loadTransactions(),
      getMembers(),
      loadParcelas(),
    ]);

    const user = store.state.user;
    const me = members.find(m => m.user_id === user.id);
    const partner = members.find(m => m.user_id !== user.id);

    const now = new Date();
    const closingDay = store.state.household?.closing_day ?? 5;
    const currentPeriod = getCurrentReportingPeriod(now, closingDay);
    const myIncome = me?.monthly_income || 0;
    const partnerIncome = partner?.monthly_income || 0;

    // Últimos 12 ciclos, respeitando o fechamento configurado pelo lar.
    const monthlyData = getReportingPeriods(now, closingDay, 12).map(period => {
      const d = period.end;
      const key = period.endKey.slice(0, 7);
      const monthTxs = transactions.filter(tx => dateKeyInPeriod(tx.date, period));
      const total = monthTxs.reduce((s, tx) => s + Number(tx.amount), 0);
      const contribution = calculateContribution(monthTxs, user.id, myIncome, partnerIncome);
      return {
        key,
        label: monthLabel(d, locale),
        total,
        year: d.getFullYear(),
        ...contribution,
      };
    });

    const maxMonthly = Math.max(...monthlyData.map(d => d.total), 1);

    // Category breakdown
    const currentTxs = transactions.filter(tx => dateKeyInPeriod(tx.date, currentPeriod));
    const catTotals = {};
    currentTxs.forEach(tx => {
      const cat = tx.category || 'outros';
      catTotals[cat] = (catTotals[cat] || 0) + Number(tx.amount);
    });
    const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const maxCat = catEntries.length > 0 ? catEntries[0][1] : 1;
    const totalCurrent = catEntries.reduce((s, [, v]) => s + v, 0);

    // Projection: expected installments for next 12 months
    const projectionMonths = [];
    for (let i = 1; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const paVal = parcelas.reduce((sum, p) => sum + getProjectedInstallmentValue(p, i - 1), 0);
      projectionMonths.push({ key, label: monthLabel(d, locale), total: paVal, year: d.getFullYear(), monthIndex: i });
    }
    const maxProjection = Math.max(...projectionMonths.map(m => m.total), 1);

    // Consolidado: média de gastos dos últimos 3 meses com movimento
    const recentWithData = monthlyData.slice(-3).filter(m => m.total > 0);
    const avgExpenses = recentWithData.length > 0
      ? recentWithData.reduce((s, m) => s + m.total, 0) / recentWithData.length
      : 0;
    const maxConsolidated = Math.max(...projectionMonths.map(m => m.total + avgExpenses), 1);


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

      ${projectionMonths.some(m => m.total > 0) ? `
      <div class="chart-section">
        <h2><i class="ph ph-calendar"></i> ${t('charts.installmentProjection')}</h2>
        <div class="card">
          <div class="chart-bar-container">
            ${projectionMonths.map(m => {
              const pct = maxProjection > 0 ? (m.total / maxProjection) * 100 : 0;
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
      ` : ''}

      ${projectionMonths.some(m => m.total > 0) || avgExpenses > 0 ? `
      <div class="chart-section">
        <h2><i class="ph ph-stack"></i> ${t('charts.consolidated')}</h2>
        <div class="card">
          <p style="font-size:0.8125rem;color:var(--muted-dark);margin-bottom:var(--space-lg);">
            ${t('charts.consolidatedText', { avg: formatCurrency(avgExpenses) })}
          </p>
          <div class="chart-bar-container">
            ${projectionMonths.map(m => {
              const consolidated = m.total + avgExpenses;
              const pctParcelas = maxConsolidated > 0 ? (m.total / maxConsolidated) * 100 : 0;
              const pctGastos = maxConsolidated > 0 ? (avgExpenses / maxConsolidated) * 100 : 0;
              return `
                <div class="chart-bar-wrapper">
                  <span class="chart-bar-value">${consolidated > 0 ? formatCurrency(consolidated) : ''}</span>
                  <div class="chart-stack">
                    <div class="chart-stack-seg chart-stack-gastos" style="height:${Math.max(pctGastos, 2)}%"></div>
                    <div class="chart-stack-seg chart-stack-parcelas" style="height:${Math.max(pctParcelas, 2)}%"></div>
                  </div>
                  <span class="chart-bar-label">${m.label}/${String(m.year).slice(2)}</span>
                </div>
              `;
            }).join('')}
          </div>
          <div class="chart-legend">
            <span class="chart-legend-item"><span class="chart-legend-dot" style="background:var(--brand);"></span> ${t('charts.legendInstallments')}</span>
            <span class="chart-legend-item"><span class="chart-legend-dot" style="background:var(--success);"></span> ${t('charts.legendExpenses')}</span>
          </div>
        </div>
      </div>
      ` : ''}

      ${partner ? `
      <div class="chart-section">
        <h2><i class="ph ph-users"></i> ${t('charts.contributionRealVsExpected')}</h2>
        <div class="card">
          <p style="font-size:0.8125rem;color:var(--muted-dark);margin-bottom:var(--space-lg);">
            ${t('charts.contributionText')}
          </p>
          <div class="chart-bar-container" style="height:160px;">
            ${monthlyData.filter(m => m.total > 0).slice(-6).map(m => {
              const maxVal = Math.max(m.myPaid, m.partnerPaid, m.myExpected, m.partnerExpected, 1);
              const h = (val) => Math.max((val / maxVal) * 100, 4);
              return `
                <div class="chart-bar-wrapper">
                  <span class="chart-bar-value">${formatCurrency(m.total)}</span>
                  <div class="chart-compare-bar" role="img" aria-label="${escapeHtml(t('charts.ariaCompare', { myPaid: formatCurrency(m.myPaid), myExpected: formatCurrency(m.myExpected), partner: partner.name || t('common.partnerFallback'), partnerPaid: formatCurrency(m.partnerPaid), partnerExpected: formatCurrency(m.partnerExpected) }))}">
                    <div class="chart-person-pair" title="${t('charts.youAndExpected')}">
                      <div class="bar-real" style="height:${h(m.myPaid)}%"></div>
                      <div class="bar-expected" style="height:${h(m.myExpected)}%"></div>
                    </div>
                    <div class="chart-person-pair partner" title="${escapeHtml(t('charts.partnerAndExpected', { partner: partner.name || t('common.partnerFallback') }))}">
                      <div class="bar-real" style="height:${h(m.partnerPaid)}%"></div>
                      <div class="bar-expected" style="height:${h(m.partnerExpected)}%"></div>
                    </div>
                  </div>
                  <span class="chart-bar-label">${m.label}/${String(m.year).slice(2)}</span>
                </div>
              `;
            }).join('')}
          </div>
          <div class="chart-legend">
            <span class="chart-legend-item"><span class="chart-legend-dot" style="background:var(--brand);"></span> ${t('charts.legendYouPaid')}</span>
            <span class="chart-legend-item"><span class="chart-legend-dot chart-legend-dot-outline"></span> ${t('charts.legendYouExpected')}</span>
            <span class="chart-legend-item"><span class="chart-legend-dot" style="background:var(--info);"></span> ${t('charts.legendPartnerPaid')}</span>
            <span class="chart-legend-item"><span class="chart-legend-dot chart-legend-dot-outline partner"></span> ${t('charts.legendPartnerExpected')}</span>
          </div>
          <div style="display:flex;gap:var(--space-xxl);margin-top:var(--space-lg);font-size:0.8125rem;">
            <div>
              <div style="color:var(--muted-dark);">${t('common.youWithName', { name: escapeHtml(me?.name || t('common.me')) })}</div>
              <div style="color:var(--brand-light);font-weight:600;font-family:var(--font-mono);">${formatCurrency(monthlyData.reduce((s, m) => s + m.myPaid, 0))}</div>
            </div>
            <div>
              <div style="color:var(--muted-dark);">${escapeHtml(partner.name || t('common.partnerFallback'))}</div>
              <div style="color:var(--info);font-weight:600;font-family:var(--font-mono);">${formatCurrency(monthlyData.reduce((s, m) => s + m.partnerPaid, 0))}</div>
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      ${!partner ? `
      <div class="chart-section">
        <h2><i class="ph ph-users"></i> ${t('charts.contribution')}</h2>
        <div class="card">
          <div class="empty-state">
            <div class="empty-state-icon"><i class="ph ph-heartbeat" style="font-size:2.5rem;color:var(--brand);"></i></div>
            <div class="empty-state-title">${t('charts.invitePartnerTitle')}</div>
            <div class="empty-state-text">${t('charts.invitePartnerText')}</div>
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
