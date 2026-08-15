import { apiFetch } from './api.js';
import { store } from '../store.js';
import { mapDivisionType } from './transaction.js';

const FI_PH_ICONS = { casa: 'house-line', carro: 'car', celular: 'device-mobile', móvel: 'couch', outros: 'package' };
export const FI_CATEGORIES = Object.keys(FI_PH_ICONS);
export function getFiIcon(category) { return FI_PH_ICONS[category] || 'package'; }
export async function loadParcelas() { const { parcelas } = await apiFetch('/parcelas'); store.setState({ parcelas }); return parcelas; }
export async function createParcela(data) {
  const { parcela } = await apiFetch('/parcelas', { method: 'POST', body: {
    name: data.name,
    total_value: data.total_value,
    total_installments: Number(data.total_installments),
    paid_installments: Number(data.paid_installments || 0),
    due_day: Number(data.due_day),
    responsible: data.responsible,
    split_type: mapDivisionType(data.division_type),
    icon: data.icon,
  } });
  await loadParcelas();
  return parcela;
}
export async function payInstallment(id) { const { parcela } = await apiFetch(`/parcelas/${id}/pay`, { method: 'POST' }); await loadParcelas(); return parcela; }
export async function reversePayment(parcelaId, paymentId) {
  const { parcela } = await apiFetch(`/parcelas/${parcelaId}/payments/${paymentId}`, { method: 'DELETE' });
  await loadParcelas();
  return parcela;
}
export async function deleteParcela(id) { await apiFetch(`/parcelas/${id}`, { method: 'DELETE' }); await loadParcelas(); }
