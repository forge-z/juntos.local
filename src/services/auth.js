import { store } from '../store.js';
import { apiFetch } from './api.js';

let sessionPromise = null;

export async function login(username, password) {
  const data = await apiFetch('/auth/login', { method: 'POST', body: { username, password } });
  store.setState({ user: data.user, session: true, tier: 'premium' });
  sessionPromise = Promise.resolve({ user: data.user, must_change_password: data.must_change_password, setup_required: data.setup_required });
  return data;
}

export async function logout() {
  await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
  store.setState({ user: null, session: null, tier: 'premium', household: null, transactions: [], parcelas: [] });
  sessionPromise = null;
}

export async function getSession({ force = false } = {}) {
  if (sessionPromise && !force) return sessionPromise;
  sessionPromise = (async () => {
    try {
      const data = await apiFetch('/auth/me');
      store.setState({ user: data.user, session: true, tier: 'premium' });
      return { user: data.user, must_change_password: data.must_change_password, setup_required: data.setup_required };
    } catch (error) {
      if (error.status === 401) return null;
      throw error;
    }
  })();
  try { return await sessionPromise; }
  catch (error) { sessionPromise = null; throw error; }
}

export async function refreshUser() {
  const session = await getSession();
  return session?.user || null;
}

export async function updatePassword(password, currentPassword = '') {
  return apiFetch('/auth/password', { method: 'PATCH', body: { password, current_password: currentPassword } });
}

export function onAuthChange() {
  return { data: { subscription: { unsubscribe() {} } } };
}
