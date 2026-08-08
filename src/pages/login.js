import { login } from '../services/auth.js';
import { navigate } from '../router.js';
import { t, tError } from '../i18n/index.js';

export default function loginPage() {
  const app = document.getElementById('app');
  document.body.className = '';
  app.innerHTML = `
    <div class="auth-page"><div class="auth-card">
      <div class="logo"><i class="ph ph-heart" style="font-size:1.5rem;color:var(--brand);"></i><span>juntos</span></div>
      <h1>Entrar</h1>
      <p class="page-subtitle">Finanças a dois, no seu servidor.</p>
      <form id="login-form">
        <div class="input-group" style="margin-bottom:16px"><label for="username">Usuário</label><input type="text" id="username" class="input" required autocomplete="username" autocapitalize="none"></div>
        <div class="input-group" style="margin-bottom:8px"><label for="password">Senha</label><input type="password" id="password" class="input" required autocomplete="current-password"></div>
        <div id="login-error" class="form-error" style="margin-bottom:12px;display:none"></div>
        <button type="submit" class="btn btn-primary btn-lg" id="login-btn">Entrar</button>
      </form>
      <div class="auth-link">Acesso local de Alexandre e Priscila</div>
    </div></div>`;
  const form = document.getElementById('login-form');
  const error = document.getElementById('login-error');
  const button = document.getElementById('login-btn');
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); error.style.display = 'none'; button.disabled = true;
    try {
      const data = await login(document.getElementById('username').value.trim().toLowerCase(), document.getElementById('password').value);
      navigate(data.must_change_password ? '/settings' : '/dashboard');
    }
    catch (err) { error.textContent = tError(err); error.style.display = 'block'; button.disabled = false; }
  });
}
