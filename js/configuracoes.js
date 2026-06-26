import { initApp } from './app-shell.js';
import { escapeHtml, formatMoney, setButtonLoading, toast } from './ui.js';

let client;
let state;
const invitationPath = '/convite';

function fillProfile() {
  const form = document.querySelector('[data-profile-form]');
  if (!form || !state.profile) return;
  form.full_name.value = state.profile.full_name || '';
  form.email.value = state.profile.email || '';
  form.whatsapp.value = state.profile.whatsapp || '';
}

async function saveProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true);
  try {
    const { error } = await client.from('profiles').update({
      full_name: form.full_name.value.trim(),
      whatsapp: form.whatsapp.value.trim() || null,
      updated_at: new Date().toISOString()
    }).eq('id', state.session.user.id);
    if (error) throw error;
    toast('Perfil atualizado.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

function accountTypeLabel(type) {
  return ({
    checking: 'Conta corrente',
    savings: 'Poupança/reserva',
    cash: 'Dinheiro',
    investment: 'Investimento',
    other: 'Outra'
  })[type] || type;
}

function roleLabel(role) {
  return ({
    owner: 'Proprietário',
    admin: 'Administrador',
    editor: 'Pode registrar e editar',
    viewer: 'Somente visualização'
  })[role] || role;
}

function memberStatusLabel(status) {
  return ({
    invited: 'Convidado',
    active: 'Ativo',
    suspended: 'Suspenso',
    removed: 'Removido'
  })[status] || status;
}

function invitationStatusLabel(status) {
  return ({
    pending: 'Pendente',
    accepted: 'Aceito',
    cancelled: 'Cancelado',
    expired: 'Expirado'
  })[status] || status;
}

function spaceTypeLabel(type) {
  return ({
    personal: 'Pessoal',
    household: 'Familiar',
    business: 'Profissional'
  })[type] || type;
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

async function loadAccounts() {
  const body = document.querySelector('[data-accounts-body]');
  const empty = document.querySelector('[data-accounts-empty]');
  const space = state.currentSpace;
  if (!space) return;

  const { data, error } = await client
    .from('accounts')
    .select('id, name, type, current_balance')
    .eq('financial_space_id', space.id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at');

  if (error) throw error;
  if (!data?.length) {
    body.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  body.innerHTML = data.map((item) => `<tr>
    <td>${escapeHtml(item.name)}</td>
    <td>${escapeHtml(accountTypeLabel(item.type))}</td>
    <td class="money">${formatMoney(item.current_balance)}</td>
  </tr>`).join('');
}

async function createAccount(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const balance = Number(form.current_balance.value || 0);
  setButtonLoading(button, true);

  try {
    const { error } = await client.from('accounts').insert({
      financial_space_id: state.currentSpace.id,
      name: form.name.value.trim(),
      type: form.type.value,
      initial_balance: balance,
      current_balance: balance
    });
    if (error) throw error;

    form.reset();
    form.current_balance.value = '0';
    toast('Conta adicionada.', 'success');
    await loadAccounts();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function createSpace(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true);

  try {
    const { data: newSpaceId, error } = await client.rpc('create_financial_space', {
      p_name: form.name.value.trim(),
      p_type: form.type.value
    });
    if (error) throw error;

    if (newSpaceId) localStorage.setItem('dmdn.currentSpaceId', newSpaceId);
    toast('Espaço financeiro criado.', 'success');
    window.setTimeout(() => window.location.reload(), 700);
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

function makeInvitationUrl(token) {
  const url = new URL(invitationPath, window.location.origin);
  url.searchParams.set('token', token);
  return url.href;
}

async function loadMembers() {
  const body = document.querySelector('[data-members-body]');
  const empty = document.querySelector('[data-members-empty]');
  const { data, error } = await client.rpc('get_space_members', {
    p_space_id: state.currentSpace.id
  });
  if (error) throw error;

  if (!data?.length) {
    body.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  body.innerHTML = data.map((member) => `<tr>
    <td>${escapeHtml(member.full_name)}</td>
    <td>${escapeHtml(member.email)}</td>
    <td>${escapeHtml(roleLabel(member.member_role))}</td>
    <td><span class="badge ${member.member_status === 'active' ? 'badge-green' : 'badge-gold'}">${escapeHtml(memberStatusLabel(member.member_status))}</span></td>
  </tr>`).join('');
}

async function loadSpaceInvitations() {
  const wrapper = document.querySelector('[data-pending-invitations-wrapper]');
  const body = document.querySelector('[data-invitations-body]');

  if (!['owner', 'admin'].includes(state.currentSpace.member_role)) {
    wrapper.hidden = true;
    return;
  }

  const { data, error } = await client.rpc('get_space_invitations', {
    p_space_id: state.currentSpace.id
  });
  if (error) throw error;

  const visible = (data ?? []).filter((invite) => ['pending', 'expired'].includes(invite.invitation_status));
  wrapper.hidden = visible.length === 0;
  body.innerHTML = visible.map((invite) => `<tr>
    <td>${escapeHtml(invite.email)}</td>
    <td>${escapeHtml(roleLabel(invite.invited_role))}</td>
    <td><span class="badge ${invite.invitation_status === 'pending' ? 'badge-gold' : 'badge-red'}">${escapeHtml(invitationStatusLabel(invite.invitation_status))}</span></td>
    <td>${escapeHtml(formatDateTime(invite.expires_at))}</td>
    <td>${invite.invitation_status === 'pending' ? `<button class="btn btn-ghost" type="button" data-cancel-invitation="${invite.invitation_id}">Cancelar</button>` : '—'}</td>
  </tr>`).join('');
}

async function loadCollaboration() {
  const description = document.querySelector('[data-collaboration-description]');
  const personalNotice = document.querySelector('[data-personal-space-notice]');
  const content = document.querySelector('[data-collaboration-content]');
  const inviteForm = document.querySelector('[data-invite-form]');
  const space = state.currentSpace;

  if (!space) return;

  description.textContent = `${space.name} · espaço ${spaceTypeLabel(space.type).toLowerCase()}`;

  if (space.type === 'personal') {
    personalNotice.hidden = false;
    content.hidden = true;
    return;
  }

  personalNotice.hidden = true;
  content.hidden = false;
  inviteForm.hidden = !['owner', 'admin'].includes(space.member_role);

  await Promise.all([loadMembers(), loadSpaceInvitations()]);
}

async function createInvitation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  setButtonLoading(button, true, 'Criando...');

  try {
    const { data, error } = await client.rpc('create_space_invitation', {
      p_space_id: state.currentSpace.id,
      p_email: form.email.value.trim().toLowerCase(),
      p_role: form.role.value
    });
    if (error) throw error;

    const invitation = data?.[0];
    if (!invitation) throw new Error('O convite foi criado, mas o link não foi retornado.');

    const link = makeInvitationUrl(invitation.invitation_token);
    const linkBox = document.querySelector('[data-share-link-box]');
    document.querySelector('[data-share-link]').value = link;
    linkBox.hidden = false;

    form.reset();
    toast('Convite criado. Copie o link e envie à pessoa.', 'success');
    await loadSpaceInvitations();
  } catch (error) {
    toast(error.message || 'Não foi possível criar o convite.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function copyInvitationLink() {
  const input = document.querySelector('[data-share-link]');
  if (!input?.value) return;

  try {
    await navigator.clipboard.writeText(input.value);
    toast('Link copiado.', 'success');
  } catch {
    input.select();
    document.execCommand('copy');
    toast('Link copiado.', 'success');
  }
}

async function cancelInvitation(invitationId) {
  const { error } = await client.rpc('cancel_space_invitation', {
    p_invitation_id: invitationId
  });
  if (error) throw error;
  toast('Convite cancelado.', 'success');
  await loadSpaceInvitations();
}

async function loadReceivedInvitations() {
  const section = document.querySelector('[data-received-invitations-section]');
  const container = document.querySelector('[data-received-invitations]');
  const { data, error } = await client.rpc('get_my_pending_invitations');
  if (error) throw error;

  section.hidden = !data?.length;
  if (!data?.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = data.map((invite) => `<article class="received-invitation">
    <div>
      <span class="badge badge-blue">${escapeHtml(spaceTypeLabel(invite.space_type))}</span>
      <h3>${escapeHtml(invite.space_name)}</h3>
      <p>Convite de ${escapeHtml(invite.invited_by_name)} · ${escapeHtml(roleLabel(invite.invited_role))}</p>
      <small>Válido até ${escapeHtml(formatDateTime(invite.expires_at))}</small>
    </div>
    <button class="btn btn-primary" type="button" data-accept-received="${invite.invitation_token}">Aceitar</button>
  </article>`).join('');
}

async function acceptReceivedInvitation(token, button) {
  setButtonLoading(button, true, 'Aceitando...');
  try {
    const { data: spaceId, error } = await client.rpc('accept_space_invitation', {
      p_token: token
    });
    if (error) throw error;

    if (spaceId) localStorage.setItem('dmdn.currentSpaceId', spaceId);
    toast('Convite aceito. Abrindo o novo espaço...', 'success');
    window.setTimeout(() => window.location.reload(), 700);
  } catch (error) {
    toast(error.message || 'Não foi possível aceitar o convite.', 'error');
    setButtonLoading(button, false);
  }
}

initApp().then(async (ctx) => {
  client = ctx.client;
  state = ctx.state;
  fillProfile();

  document.querySelector('[data-profile-form]')?.addEventListener('submit', saveProfile);
  document.querySelector('[data-account-form]')?.addEventListener('submit', createAccount);
  document.querySelector('[data-space-form]')?.addEventListener('submit', createSpace);
  document.querySelector('[data-invite-form]')?.addEventListener('submit', createInvitation);
  document.querySelector('[data-copy-invite]')?.addEventListener('click', copyInvitationLink);

  document.querySelector('[data-invitations-body]')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cancel-invitation]');
    if (!button) return;
    cancelInvitation(button.dataset.cancelInvitation).catch((error) => toast(error.message, 'error'));
  });

  document.querySelector('[data-received-invitations]')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-accept-received]');
    if (!button) return;
    acceptReceivedInvitation(button.dataset.acceptReceived, button);
  });

  await Promise.all([
    loadAccounts(),
    loadCollaboration(),
    loadReceivedInvitations()
  ]);
}).catch((error) => {
  console.error(error);
  toast(error.message || 'Não foi possível carregar as configurações.', 'error');
});
