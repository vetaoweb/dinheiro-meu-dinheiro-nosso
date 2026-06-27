import { requireSession } from './guard.js';
import { requireSupabase } from './supabase-client.js';
import { escapeHtml, toast } from './ui.js';
import { applyPanelPermissions } from './panel-permissions.js';

export const appState = {
  session: null,
  profile: null,
  spaces: [],
  currentSpace: null
};

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'MN';
}

function markActiveNavigation() {
  const page = document.body.dataset.page;
  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.classList.toggle('active', link.dataset.nav === page);
  });
}

function bindMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  document.querySelector('[data-mobile-menu]')?.addEventListener('click', () => sidebar?.classList.toggle('open'));
  document.addEventListener('click', (event) => {
    if (window.innerWidth > 820 || !sidebar?.classList.contains('open')) return;
    if (!sidebar.contains(event.target) && !event.target.closest('[data-mobile-menu]')) sidebar.classList.remove('open');
  });
}

async function ensureWorkspace(client) {
  const { error } = await client.rpc('ensure_user_workspace');
  if (error) throw error;
}

async function loadProfile(client, user) {
  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, email, whatsapp, status')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  appState.profile = data;

  document.querySelectorAll('[data-profile-name]').forEach((el) => { el.textContent = data.full_name || 'Minha conta'; });
  document.querySelectorAll('[data-profile-email]').forEach((el) => { el.textContent = data.email || user.email; });
  document.querySelectorAll('[data-profile-initials]').forEach((el) => { el.textContent = initials(data.full_name); });
}

async function loadSpaces(client) {
  const { data, error } = await client
    .from('space_members')
    .select('role, financial_spaces!inner(id, name, type, currency, status)')
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (error) throw error;

  appState.spaces = (data ?? []).map((item) => ({ ...item.financial_spaces, member_role: item.role }));
  const saved = localStorage.getItem('dmdn.currentSpaceId');
  appState.currentSpace = appState.spaces.find((space) => space.id === saved) || appState.spaces[0] || null;

  if (appState.currentSpace) {
    localStorage.setItem('dmdn.currentSpaceId', appState.currentSpace.id);
  }

  const select = document.querySelector('[data-space-select]');
  if (select) {
    select.innerHTML = appState.spaces.map((space) => `<option value="${space.id}">${escapeHtml(space.name)}</option>`).join('');
    if (appState.currentSpace) select.value = appState.currentSpace.id;
    select.addEventListener('change', () => {
      localStorage.setItem('dmdn.currentSpaceId', select.value);
      window.location.reload();
    });
  }
}

function bindLogout(client) {
  document.querySelector('[data-logout]')?.addEventListener('click', async () => {
    await client.auth.signOut();
    localStorage.removeItem('dmdn.currentSpaceId');
    window.location.replace('/entrar');
  });
}

export async function initApp() {
  appState.session = await requireSession();
  const client = requireSupabase();
  markActiveNavigation();
  bindMobileMenu();
  bindLogout(client);
  try {
    await ensureWorkspace(client);
    await Promise.all([
      loadProfile(client, appState.session.user),
      loadSpaces(client)
    ]);
    applyPanelPermissions(appState);
  } catch (error) {
    console.error('Falha ao inicializar a conta:', error);
    toast(error?.message || 'Falha ao carregar sua conta.', 'error');
    throw error;
  }
  return { client, state: appState };
}
