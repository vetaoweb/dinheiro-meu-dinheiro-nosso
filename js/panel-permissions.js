function ensureReadonlyNotice() {
  if (document.querySelector('[data-readonly-space-notice]')) return;
  const header = document.querySelector('.page-header');
  if (!header) return;

  const notice = document.createElement('div');
  notice.className = 'alert alert-info readonly-space-notice';
  notice.dataset.readonlySpaceNotice = '';
  notice.style.marginBottom = '18px';
  notice.textContent = 'Você participa deste espaço com permissão de visualização. Alterações estão desativadas.';
  header.insertAdjacentElement('afterend', notice);
}

function hideEditingControls() {
  const page = document.body.dataset.page;

  if (page === 'dashboard') {
    document.querySelector('.page-header .btn-primary')?.setAttribute('hidden', '');
  }

  if (page === 'lancamentos') {
    document.querySelector('[data-new-transaction]')?.setAttribute('hidden', '');
    document.querySelector('[data-new-recurring]')?.setAttribute('hidden', '');
  }

  if (page === 'metas') {
    document.querySelector('[data-new-goal]')?.setAttribute('hidden', '');
  }

  if (page === 'configuracoes') {
    document.querySelector('[data-account-form]')?.setAttribute('hidden', '');
    const accountNotice = document.querySelector('[data-account-readonly]');
    if (accountNotice) accountNotice.hidden = false;
  }

  document.querySelectorAll('[data-delete], [data-delete-recurring], [data-goal-action]').forEach((button) => {
    button.setAttribute('hidden', '');
  });
}

function observeEditingControls() {
  const observer = new MutationObserver(() => hideEditingControls());
  observer.observe(document.body, { childList: true, subtree: true });
}

function bindSettingsNavigation() {
  const buttons = [...document.querySelectorAll('[data-settings-target]')];
  if (!buttons.length) return;

  buttons.forEach((button) => {
    const section = document.getElementById(button.dataset.settingsTarget);
    if (section) section.style.scrollMarginTop = '96px';

    button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.settingsTarget);
      if (!target) return;
      buttons.forEach((item) => item.classList.toggle('active', item === button));
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

export function applyPanelPermissions(state) {
  bindSettingsNavigation();

  if (document.body.dataset.page === 'lancamentos') {
    import('./lancamentos-validation.js').catch((error) => console.error('Falha ao carregar validações:', error));
  }

  const role = state.currentSpace?.member_role;
  if (role !== 'viewer') return;

  document.body.classList.add('is-readonly-space');
  ensureReadonlyNotice();
  hideEditingControls();
  observeEditingControls();
}
