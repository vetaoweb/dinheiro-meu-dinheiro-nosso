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

function friendlyAuthError(error) {
  console.error('Erro de autenticação:', error);

  const rawMessage = typeof error?.message === 'string' ? error.message.trim() : '';
  const code = String(error?.code || '').toLowerCase();
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes('invalid login credentials')) return 'E-mail ou senha inválidos.';
  if (normalized.includes('user already registered') || code.includes('user_already_exists')) return 'Este e-mail já possui cadastro. Use a opção de entrar ou recuperar a senha.';
  if (normalized.includes('password should be') || code.includes('weak_password')) return 'A senha não atende aos requisitos mínimos de segurança.';
  if (normalized.includes('email rate limit') || code.includes('over_email_send_rate_limit')) return 'Muitas mensagens foram solicitadas. Aguarde alguns minutos e tente novamente.';
  if (normalized.includes('signup is disabled') || code.includes('signup_disabled')) return 'O cadastro está temporariamente desativado no Supabase.';
  if (normalized.includes('seed_space_defaults')) return 'A preparação da conta precisa da correção sql/013_restore_seed_space_defaults.sql no Supabase.';
  if (normalized.includes('database error saving new user') || code.includes('unexpected_failure')) return 'O cadastro chegou ao banco, mas a criação do perfil falhou. Aplique os reparos SQL mais recentes e tente novamente.';
  if (rawMessage && rawMessage !== '{}') return rawMessage;

  return 'Não foi possível concluir a operação. Atualize a página e tente novamente. O detalhe técnico foi registrado no console do navegador.';
}

async function ensureWorkspace(client) {
  const { error } = await client.rpc('ensure_user_workspace');
  if (error) throw error;
}

async function handleLogin(data) {
  const client = requireSupabase();
  const email = clean(data.get('email')).toLowerCase();
  const password = String(data.get('password') ?? '');

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await ensureWorkspace(client);
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
      data: {
        full_name: fullName,
        whatsapp,
        terms_accepted: true,
        privacy_accepted: true
      }
    }
  });
  if (error) throw error;

  if (result.session) {
    await ensureWorkspace(client);
    window.location.replace(safeNextPath());
    return;
  }

  sessionStorage.setItem('dmdn.signupEmail', email);
  form.reset();
  window.location.replace('/cadastro-sucesso');
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
      showInlineMessage(message, friendlyAuthError(error), 'error');
    } finally {
      setButtonLoading(button, false);
    }
  });
}
