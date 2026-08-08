/* ══════════════════════════════════════════════
   juntos.cash — Changelog: English
   Translated from changelog.pt-BR.js (source of truth).
   ══════════════════════════════════════════════ */

export const APP_VERSION = '1.0.0';

export const CHANGELOG = [
  {
    version: '1.0.0',
    date: '2026-07-20',
    label: 'Launch preparation',
    fixes: [
      'Fixed a build failure caused by outdated dependencies',
      'Closed unnecessary public access to an internal maintenance routine',
    ],
    features: [],
  },
  {
    version: '0.2.0',
    date: '2026-07-04',
    label: 'Light theme, reorganized settings, and in-app help',
    fixes: [
      'Home screen cards now use the same grid on top and bottom rows, no more misalignment between rows',
      'Fixed text contrast in light theme (names and values that were nearly invisible against the background)',
      'Month labels on charts now show month and year on the same line, without an awkward wrap',
      'Settings page now uses the correct screen width, matching the other pages',
    ],
    features: [
      'Light and dark theme, with an option to automatically follow the system (in Settings > Appearance)',
      'Settings reorganized into Profile, Partner, Household, and Appearance, each piece of info in the right place',
      'Pro plan unlocked for everyone during testing, directly from Settings > Profile',
      'New chart consolidating contracted installments with the average expenses of recent months',
      'Tutorial, FAQ, and finance tips for couples, now built right into the app',
      'Version badge and what\'s new moved to the bottom of Settings',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-07-03',
    label: 'First release',
    fixes: [
      'Fixed balance calculation on the Dashboard when using proportional splitting',
      'Fixed the transaction list showing the correct payer (paid_by_manual)',
      'Fixed transaction updates keeping the selected payer in the form',
      'Fixed the transaction deletion RPC fallback using the correct parameter',
      'Added protection against division by zero when displaying an installment amount',
      'Fixed errors that used innerHTML without escaping messages',
    ],
    features: [
      'Home screen with a monthly overview, per-person balance, and categories',
      'Shared expense management with proportional, 50/50, or individual splitting',
      'Financing and installments with progress tracking',
      'Monthly charts, by category, and installment projections',
      'SAC and Price amortization tables',
      'Plan system (Free / Pro / Premium)',
      'Profile, household, and payment method settings',
    ],
  },
];
