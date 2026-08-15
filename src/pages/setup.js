import { navigate } from '../router.js';
import { getSession } from '../services/auth.js';
import { apiFetch } from '../services/api.js';
import { store } from '../store.js';
import { escapeHtml } from './_helpers.js';

function slugify(value, fallback) {
  const normalized = String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  return normalized || fallback;
}

export default async function setupPage() {
  const app = document.getElementById('app');
  document.body.className = '';
  let setup;
  try {
    setup = await apiFetch('/setup');
  } catch (error) {
    if (error.status === 401) return navigate('/login', true);
    if (error.status === 404) return navigate('/dashboard', true);
    throw error;
  }

  app.innerHTML = `
    <div class="auth-page"><div class="auth-card" style="max-width:620px;">
      <div class="logo"><i class="ph ph-heart" style="font-size:1.5rem;color:var(--brand);"></i><span>juntos</span></div>
      <h1>Configuração inicial</h1>
      <p class="page-subtitle" style="margin-bottom:var(--space-xl);">Defina o administrador e crie o segundo usuário do seu lar. A senha temporária do segundo usuário deverá ser trocada no primeiro login.</p>
      <form id="setup-form">
        <h3 style="margin-bottom:var(--space-md);">Administrador</h3>
        <div class="input-group" style="margin-bottom:12px"><label for="admin-name">Nome</label><input type="text" id="admin-name" class="input" value="${escapeHtml(setup.admin.name || '')}" required maxlength="80"></div>
        <div class="input-group" style="margin-bottom:12px"><label for="admin-username">Usuário de acesso</label><input type="text" id="admin-username" class="input" value="${escapeHtml(setup.admin.username || 'admin')}" required minlength="3" maxlength="32" pattern="[a-z0-9_]+" autocapitalize="none"></div>
        <div class="input-group" style="margin-bottom:12px"><label for="admin-password">Nova senha definitiva</label><input type="password" id="admin-password" class="input" required minlength="12" autocomplete="new-password"></div>
        <div class="input-group" style="margin-bottom:20px"><label for="admin-password-confirm">Confirme a senha do administrador</label><input type="password" id="admin-password-confirm" class="input" required minlength="12" autocomplete="new-password"></div>
        <h3 style="margin-bottom:var(--space-md);">Segundo usuário</h3>
        <div class="input-group" style="margin-bottom:12px"><label for="second-name">Nome</label><input type="text" id="second-name" class="input" placeholder="Ex.: Maria" required maxlength="80"></div>
        <div class="input-group" style="margin-bottom:12px"><label for="second-username">Usuário de acesso</label><input type="text" id="second-username" class="input" placeholder="Gerado a partir do nome" required minlength="3" maxlength="32" pattern="[a-z0-9_]+" autocapitalize="none"></div>
        <div class="input-group" style="margin-bottom:12px"><label for="second-password">Senha provisória</label><input type="password" id="second-password" class="input" required minlength="12" autocomplete="new-password"></div>
        <div class="input-group" style="margin-bottom:20px"><label for="second-password-confirm">Confirme a senha provisória</label><input type="password" id="second-password-confirm" class="input" required minlength="12" autocomplete="new-password"></div>
        <div id="setup-error" class="form-error" style="margin-bottom:12px;display:none"></div>
        <button type="submit" class="btn btn-primary btn-lg" id="setup-btn">Concluir configuração</button>
      </form>
      <div class="auth-link">A senha temporária inicial do administrador deixa de funcionar após esta etapa.</div>
    </div></div>`;

  const form = document.getElementById('setup-form');
  const error = document.getElementById('setup-error');
  const button = document.getElementById('setup-btn');
  const secondName = document.getElementById('second-name');
  const secondUsername = document.getElementById('second-username');
  let usernameEdited = false;
  secondUsername.addEventListener('input', () => { usernameEdited = true; });
  secondName.addEventListener('input', () => {
    if (!usernameEdited) secondUsername.value = slugify(secondName.value, 'usuario2');
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.style.display = 'none';
    const adminPassword = document.getElementById('admin-password').value;
    const secondPassword = document.getElementById('second-password').value;
    if (adminPassword !== document.getElementById('admin-password-confirm').value || secondPassword !== document.getElementById('second-password-confirm').value) {
      error.textContent = 'As confirmações de senha não conferem.';
      error.style.display = 'block';
      return;
    }
    button.disabled = true;
    button.textContent = 'Salvando...';
    try {
      const result = await apiFetch('/setup', {
        method: 'POST',
        body: {
          admin_name: document.getElementById('admin-name').value.trim(),
          admin_username: document.getElementById('admin-username').value.trim().toLowerCase(),
          admin_password: adminPassword,
          second_name: secondName.value.trim(),
          second_username: secondUsername.value.trim().toLowerCase(),
          second_password: secondPassword,
        },
      });
      store.setState({ user: result.admin, session: true, household: null });
      await getSession({ force: true });
      navigate('/dashboard', true);
    } catch (err) {
      error.textContent = err?.message || 'Não foi possível concluir a configuração.';
      error.style.display = 'block';
      button.disabled = false;
      button.textContent = 'Concluir configuração';
    }
  });
}
