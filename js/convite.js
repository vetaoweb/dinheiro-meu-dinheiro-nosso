import { isSupabaseConfigured, requireSupabase } from './supabase-client.js';
import { setButtonLoading, showInlineMessage, registerServiceWorker } from './ui.js';

registerServiceWorker();

const title = document.querySelector('[data-invite-title]');
const description = document.querySelector('[data-invite-description]');
const details = document.querySelector('[data-invite-details]');
const message = document.querySelector('[data-invite-message]');
const guestActions = document.querySelector('[data-guest-actions]');
const memberActions = document.querySelector('[data-member-actions]');
const acceptButton = document.querySelector('[data-accept-invite]');

const token = new URLSearchParams(window.location.search).get('token');
const loginPath = '/entrar';
const signupPath = '/cadastro';
const dashboardPath = '/painel';

function roleLabel(role) {
  return ({
    admin: 'Administrador',
    editor: 'Pode registrar e editar',
    viewer: 'Somente visualização'
  })[role] || role;
}

function typeLabel(type) {
  return ({
    household: 'Familiar/compartilhado',
    business: 'Profissional/negócio'
  })[type] || type;
}

function formatExpiry(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(new Date(value));
}

function currentInvitePath() {
  return `${window.location.pathname}${window.location.search}`;
}

function configureAuthLinks() {
  const next = encodeURIComponent(currentInvitePath());
  document.querySelector('[data-login-link]').href = `${loginPath}?next=${next}`;
  document.querySelector('[data-signup-link]').href = `${signupPath}?next=${next}`;
}

function showInvalid(text) {
  title.textContent = 'Convite indisponível';
  description.textContent = text;
  details.hidden = true;
  guestActions.hidden = true;
  memberActions.hidden = true;
}

async function ensureWorkspace(client) {
  const { error } = await client.rpc('ensure_user_workspace');
  if (error) throw error;
}

async function loadInvitation() {
  if (!isSupabaseConfigured()) {
    showInvalid('A conexão com o sistema ainda não está configurada.');
    return;
  }

  if (!token) {
    showInvalid('O endereço do convite está incompleto. Solicite um novo link ao responsável pelo espaço.');
    return;
  }

  configureAuthLinks();
  const client = requireSupabase();

  const { data: previewRows, error: previewError } = await client.rpc('get_invitation_preview', {
    p_token: token
  });

  if (previewError) throw previewError;
  const preview = previewRows?.[0];
  if (!preview) {
    showInvalid('Não encontramos um convite correspondente a este endereço.');
    return;
  }

  title.textContent = preview.space_name;
  description.textContent = 'Você foi convidado para participar deste espaço financeiro sem expor seu espaço pessoal.';
  document.querySelector('[data-invite-space]').textContent = preview.space_name;
  document.querySelector('[data-invite-type]').textContent = typeLabel(preview.space_type);
  document.querySelector('[data-invite-role]').textContent = roleLabel(preview.invited_role);
  document.querySelector('[data-invite-email]').textContent = preview.masked_email;
  document.querySelector('[data-invite-expiry]').textContent = formatExpiry(preview.expires_at);
  details.hidden = false;

  if (preview.invitation_status !== 'pending') {
    const statusText = ({
      accepted: 'Este convite já foi aceito.',
      cancelled: 'Este convite foi cancelado.',
      expired: 'Este convite expirou.'
    })[preview.invitation_status] || 'Este convite não está mais disponível.';
    showInlineMessage(message, statusText, 'info');
    return;
  }

  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData.session;
  guestActions.hidden = Boolean(session);
  memberActions.hidden = !session;

  if (session) {
    await ensureWorkspace(client);
    showInlineMessage(message, `Você está conectado como ${session.user.email}.`, 'info');
  }
}

acceptButton?.addEventListener('click', async () => {
  const client = requireSupabase();
  setButtonLoading(acceptButton, true, 'Aceitando...');

  try {
    await ensureWorkspace(client);
    const { data: spaceId, error } = await client.rpc('accept_space_invitation', {
      p_token: token
    });
    if (error) throw error;

    localStorage.setItem('dmdn.currentSpaceId', spaceId);
    showInlineMessage(message, 'Convite aceito. Abrindo o espaço compartilhado...', 'success');
    window.setTimeout(() => window.location.replace(dashboardPath), 900);
  } catch (error) {
    console.error('Falha ao aceitar convite:', error);
    showInlineMessage(message, error?.message || 'Não foi possível aceitar o convite.', 'error');
  } finally {
    setButtonLoading(acceptButton, false);
  }
});

loadInvitation().catch((error) => {
  console.error('Falha ao carregar convite:', error);
  showInvalid(error?.message || 'Não foi possível carregar o convite.');
});
