/* ══════════════════════════════════════════════
   juntos.cash — Estado compartilhado
   ══════════════════════════════════════════════ */

export const store = {
  state: {
    user: null,
    session: null,
    tier: 'premium',
    household: null,
    loading: true,
    transactions: [],
    parcelas: [],
    currentRoute: '',
  },
  setState(updates) {
    Object.assign(this.state, updates);
  },
};
