import { t } from '../i18n/index.js';
import { formatCurrency } from '../pages/_helpers.js';

export const TIER_LABELS = () => ({ premium: 'Completo' });
export const TIER_PRICES = () => ({ premium: 'Local' });
export const FEATURE_LIST = () => [
  { key: 'transactions', label: t('feature.transactions'), premium: true },
  { key: 'dashboard', label: t('feature.dashboard'), premium: true },
  { key: 'parcelado', label: t('feature.parcelado'), premium: true },
  { key: 'charts', label: t('feature.charts'), premium: true },
  { key: 'export', label: t('feature.export'), premium: true },
  { key: 'guide', label: t('feature.guide'), premium: true },
  { key: 'sac', label: t('feature.sac'), premium: true },
  { key: 'price', label: t('feature.price'), premium: true },
];
export function getCurrentTier() { return 'premium'; }
export async function refreshTier() { return 'premium'; }
export function checkFeature() { return true; }
export function getTierLabel() { return TIER_LABELS().premium; }
export { formatCurrency };
