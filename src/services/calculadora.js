// Parcelas simples: valor da parcela = total / quantidade. Sem SAC/Price.
export function getProjectedInstallmentValue(parcela, monthOffset = 0) {
  const total = Math.max(Math.trunc(Number(parcela.total_installments) || 0), 0);
  const paid = Math.min(Math.max(Math.trunc(Number(parcela.paid_installments) || 0), 0), total);
  const index = paid + Math.max(Math.trunc(Number(monthOffset) || 0), 0);
  if (total <= 0 || index >= total) return 0;
  return Number(parcela.total_value) / total;
}
