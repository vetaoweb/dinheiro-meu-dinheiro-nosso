import { isSupabaseConfigured, requireSupabase } from './supabase-client.js';
import { setButtonLoading, showInlineMessage, registerServiceWorker } from './ui.js';

registerServiceWorker();

const form = document.querySelector('[data-auth-form]');
const message = document.querySelector('[data-auth-message]');

if (!isSupabaseConfigured()) {
  showInlineMessage(message, 'A conexão ainda precisa da chave pública anon/publishable do Supabase em js/env.js.', 'info');
}

function clean(value) {
  return String(value ?? '').trim();
}

function safeNextPath(defaultPath = '/painel') {
  const value = new URLSearchParams(window.location.search).get('next');
  if (!value || !value.startsWith('/') || value.startsWith('//')) return defaultPath;

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return defaultPath;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return defaultPath;
  }
}

function absoluteNextUrl() {
  return new URL(safeNextPath(), window.location.origin).href;
}

async function handleLogin(data) {
  const client = requireSupabase();
  const email = clean(data.get('email')).toLowerCase();
  const password = String(data.get('password') ?? '');

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  window.location.replace(safeNextPath());
}

async function handleSignup(data) {
  const client = requireSupabase();
  const fullName = clean(data.get('full_name'));
  const email = clean(data.get('email')).toLowerCase();
  const whatsapp = clean(data.get('whatsapp'));
  const password = String(data.get('password') ?? '');
  const confirmation = String(data.get('password_confirmation') ?? '');
  const accepted = data.get('terms') === 'on';

  if (fullName.length < 3) throw new Error('Informe seu nome completo.');
  if (password.length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');
  if (password !== confirmation) throw new Error('As senhas não coincidem.');
  if (!accepted) throw new Error('É necessário aceitar os Termos de Uso e a Política de Privacidade.');

  const { data: result, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: absoluteNextUrl(),
      data: { full_name: fullName, whatsapp }
    }
  });
  if (error) throw error;

  if (result.session) {
    window.location.replace(safeNextPath());
    return;
  }

  form.reset();
  showInlineMessage(message, 'Cadastro criado. Confirme o e-mail recebido para continuar.', 'success');
}

async function handleRecover(data) {
  const client = requireSupabase();
  const email = clean(data.get('email')).toLowerCase();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.DMDN_ENV.APP_URL}/redefinir-senha`
  });
  if (error) throw error;
  form.reset();
  showInlineMessage(message, 'Se o e-mail estiver cadastrado, você receberá as instruções de redefinição.', 'success');
}

async function handleReset(data) {
  const client = requireSupabase();
  const password = String(data.get('password') ?? '');
  const confirmation = String(data.get('password_confirmation') ?? '');
  if (password.length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');
  if (password !== confirmation) throw new Error('As senhas não coincidem.');
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
  showInlineMessage(message, 'Senha alterada. Você já pode acessar o painel.', 'success');
  window.setTimeout(() => window.location.replace('/painel'), 1200);
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const action = form.dataset.authForm;
    const data = new FormData(form);
    message.hidden = true;
    setButtonLoading(button, true);

    try {
      if (action === 'login') await handleLogin(data);
      if (action === 'signup') await handleSignup(data);
      if (action === 'recover') await handleRecover(data);
      if (action === 'reset') await handleReset(data);
    } catch (error) {
      const friendly = error?.message?.includes('Invalid login credentials')
        ? 'E-mail ou senha inválidos.'
        : error?.message || 'Não foi possível concluir a operação.';
      showInlineMessage(message, friendly, 'error');
    } finally {
      setButtonLoading(button, false);
    }
  });
}
