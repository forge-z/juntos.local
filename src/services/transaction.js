import { apiFetch } from './api.js';
import { store } from '../store.js';
import { localDateKey } from './reporting-period.js';

export const CATEGORY_PH_ICONS = { alimentação: 'fork-knife', moradia: 'house-line', transporte: 'car', saúde: 'first-aid-kit', lazer: 'game-controller', educação: 'book-open', assinaturas: 'television', vestuário: 't-shirt', outros: 'package' };
export const CATEGORIES = Object.keys(CATEGORY_PH_ICONS);
export const DIVISION_TYPES = ['proporcional', '50/50', 'individual'];
export const CATEGORY_COLORS = { alimentação: 'var(--cat-alimentacao)', moradia: 'var(--cat-moradia)', transporte: 'var(--cat-transporte)', saúde: 'var(--cat-saude)', lazer: 'var(--cat-lazer)', educação: 'var(--cat-educacao)', assinaturas: 'var(--cat-assinaturas)', vestuário: 'var(--cat-vestuario)', outros: 'var(--cat-outros)' };
export function getCategoryIcon(category) { return CATEGORY_PH_ICONS[category] || 'package'; }
export function mapDivisionType(type) { return { proporcional: 'proportional', '50/50': 'equal', individual: 'individual' }[type] || 'equal'; }
export function splitTypeToDivision(type) { return { proportional: 'proporcional', equal: '50/50', individual: 'individual' }[type] || '50/50'; }

export async function loadTransactions() {
  const all = [];
  let cursor = null;
  do {
    const query = new URLSearchParams({ limit: '200' });
    if (cursor) query.set('cursor', cursor);
    const page = await apiFetch(`/transactions?${query}`);
    all.push(...page.transactions);
    cursor = page.pagination?.has_more ? page.pagination.next_cursor : null;
  } while (cursor);
  store.setState({ transactions: all });
  return all;
}
export async function createTransaction(data) { const { transaction } = await apiFetch('/transactions', { method: 'POST', body: { ...data, date: data.date || localDateKey(), split_type: mapDivisionType(data.division_type), paid_by: data.paid_by } }); await loadTransactions(); return transaction; }
export async function updateTransaction(id, data) { const { transaction } = await apiFetch(`/transactions/${id}`, { method: 'PATCH', body: { ...data, date: data.date || localDateKey(), split_type: mapDivisionType(data.division_type), paid_by: data.paid_by } }); await loadTransactions(); return transaction; }
export async function deleteTransaction(id) { await apiFetch(`/transactions/${id}`, { method: 'DELETE' }); await loadTransactions(); }
