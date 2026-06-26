import { initApp } from './app-shell.js';
import { escapeHtml, formatMoney, setButtonLoading, toast } from './ui.js';

let client;
let state;

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
  return ({ checking: 'Conta corrente', savings: 'Poupança/reserva', cash: 'Dinheiro', investment: 'Investimento', other: 'Outra' })[type] || type;
}

async function loadAccounts() {
  const body = document.querySelector('[data-accounts-body]');
  const empty = document.querySelector('[data-accounts-empty]');
  const space = state.currentSpace;
  if (!space) return;
  const { data, error } = await client.from('accounts').select('id, name, type, current_balance').eq('financial_space_id', space.id).eq('status', 'active').is('deleted_at', null).order('created_at');
  if (error) throw error;
  if (!data?.length) {
    body.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  body.innerHTML = data.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(accountTypeLabel(item.type))}</td><td class="money">${formatMoney(item.current_balance)}</td></tr>`).join('');
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
    const { error } = await client.rpc('create_financial_space', {
      p_name: form.name.value.trim(),
      p_type: form.type.value
    });
    if (error) throw error;
    toast('Espaço financeiro criado.', 'success');
    window.setTimeout(() => window.location.reload(), 700);
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

initApp().then((ctx) => {
  client = ctx.client;
  state = ctx.state;
  fillProfile();
  document.querySelector('[data-profile-form]')?.addEventListener('submit', saveProfile);
  document.querySelector('[data-account-form]')?.addEventListener('submit', createAccount);
  document.querySelector('[data-space-form]')?.addEventListener('submit', createSpace);
  loadAccounts().catch((error) => toast(error.message, 'error'));
}).catch(console.error);
