import { apiFetch } from './api.js';
import { store } from '../store.js';

export async function loadHousehold() {
  try { const { household } = await apiFetch('/household'); store.setState({ household, loading: false }); return household; }
  catch (error) { if (error.status === 404) store.setState({ household: null, loading: false }); throw error; }
}
export async function getMembers() { const { members } = await apiFetch('/household/members'); return members; }
export async function updateMemberIncome(profileId, income) { return apiFetch(`/household/members/${profileId}`, { method: 'PATCH', body: { monthly_income: Number(income) } }); }
export async function updateHousehold(updates) { const { household } = await apiFetch('/household', { method: 'PATCH', body: updates }); store.setState({ household }); return household; }
