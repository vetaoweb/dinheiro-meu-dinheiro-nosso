import { initApp } from './app-shell.js';
import { escapeHtml, formatDate, formatMoney, setButtonLoading, toast } from './ui.js';

let client;
let state;
let goals = [];

function canEdit() {
  return ['owner', 'admin', 'editor'].includes(state.currentSpace?.member_role);
}

function statusLabel(status) {
  return ({
    active: 'Ativa',
    paused: 'Pausada',
    completed: 'Concluída',
    cancelled: 'Arquivada'
  })[status] || status;
}

function statusBadge(status) {
  return ({
    active: 'badge-green',
    paused: 'badge-gold',
    completed: 'badge-blue',
    cancelled: 'badge-red'
  })[status] || 'badge-blue';
}

function percentage(goal) {
  const target = Number(goal.target_amount || 0);
  const current = Number(goal.current_amount || 0);
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

function deadlineText(value) {
  if (!value) return 'Sem prazo definido';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${value}T00:00:00`);
  const days = Math.ceil((target - today) / 86400000);
  if (days < 0) return `Prazo vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Prazo termina hoje';
  return `${days} dia${days === 1 ? '' : 's'} restantes`;
}

function renderSummary() {
  const activeGoals = goals.filter((goal) => ['active', 'paused'].includes(goal.status));
  const target = activeGoals.reduce((sum, goal) => sum + Number(goal.target_amount || 0), 0);
  const current = activeGoals.reduce((sum, goal) => sum + Number(goal.current_amount || 0), 0);
  document.querySelector('[data-goals-target]').textContent = formatMoney(target);
  document.querySelector('[data-goals-current]').textContent = formatMoney(current);
  document.querySelector('[data-goals-active]').textContent = String(goals.filter((goal) => goal.status === 'active').length);
  document.querySelector('[data-goals-completed]').textContent = String(goals.filter((goal) => goal.status === 'completed').length);
}

function actionButtons(goal) {
  if (!canEdit()) return '';

  const buttons = [];
  if (goal.status === 'active') {
    buttons.push(`<button class="btn btn-primary" type="button" data-goal-action="contribute" data-goal-id="${goal.id}">Adicionar valor</button>`);
    buttons.push(`<button class="btn btn-ghost" type="button" data-goal-action="pause" data-goal-id="${goal.id}">Pausar</button>`);
  }
  if (goal.status === 'paused') {
    buttons.push(`<button class="btn btn-secondary" type="button" data-goal-action="resume" data-goal-id="${goal.id}">Retomar</button>`);
  }
  if (goal.status !== 'completed') {
    buttons.push(`<button class="btn btn-ghost" type="button" data-goal-action="complete" data-goal-id="${goal.id}">Concluir</button>`);
  }
  buttons.push(`<button class="btn btn-ghost" type="button" data-goal-action="archive" data-goal-id="${goal.id}">Arquivar</button>`);
  return buttons.join('');
}

function renderGoals() {
  const grid = document.querySelector('[data-goals-grid]');
  const empty = document.querySelector('[data-goals-empty]');
  const visible = goals.filter((goal) => goal.status !== 'cancelled');

  if (!visible.length) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  grid.innerHTML = visible.map((goal) => {
    const progress = percentage(goal);
    const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
    return `<article class="card goal-card">
      <div class="goal-card-header">
        <div>
          <span class="badge ${statusBadge(goal.status)}">${escapeHtml(statusLabel(goal.status))}</span>
          <h2>${escapeHtml(goal.name)}</h2>
        </div>
        <strong class="goal-percent">${progress}%</strong>
      </div>
      <div class="goal-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
        <i style="width:${progress}%"></i>
      </div>
      <div class="goal-values">
        <div><span>Acumulado</span><strong>${formatMoney(goal.current_amount)}</strong></div>
        <div><span>Objetivo</span><strong>${formatMoney(goal.target_amount)}</strong></div>
        <div><span>Falta</span><strong>${formatMoney(remaining)}</strong></div>
      </div>
      <div class="goal-deadline">
        <span>${goal.target_date ? `Prazo: ${formatDate(goal.target_date)}` : 'Prazo livre'}</span>
        <strong>${escapeHtml(deadlineText(goal.target_date))}</strong>
      </div>
      <div class="goal-actions">${actionButtons(goal)}</div>
    </article>`;
  }).join('');
}

async function loadGoals() {
  const { data, error } = await client
    .from('goals')
    .select('id, name, target_amount, current_amount, target_date, status, created_at')
    .eq('financial_space_id', state.currentSpace.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  goals = data ?? [];
  renderSummary();
  renderGoals();
}

function openGoalModal() {
  if (!canEdit()) return toast('Seu perfil neste espaço possui somente visualização.', 'error');
  document.querySelector('[data-goal-modal]').classList.remove('hidden');
  document.querySelector('#goal-name').focus();
}

function closeGoalModal() {
  document.querySelector('[data-goal-modal]').classList.add('hidden');
}

function openContributionModal(goal) {
  const form = document.querySelector('[data-contribution-form]');
  form.goal_id.value = goal.id;
  form.goal_name.value = goal.name;
  form.amount.value = '';
  document.querySelector('[data-contribution-modal]').classList.remove('hidden');
  form.amount.focus();
}

function closeContributionModal() {
  document.querySelector('[data-contribution-modal]').classList.add('hidden');
}

async function createGoal(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const targetAmount = Number(form.target_amount.value);
  const currentAmount = Number(form.current_amount.value || 0);

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) return toast('Informe um valor desejado maior que zero.', 'error');
  if (!Number.isFinite(currentAmount) || currentAmount < 0) return toast('O valor inicial não pode ser negativo.', 'error');

  setButtonLoading(button, true);
  try {
    const completed = currentAmount >= targetAmount;
    const { error } = await client.from('goals').insert({
      financial_space_id: state.currentSpace.id,
      name: form.name.value.trim(),
      target_amount: targetAmount,
      current_amount: currentAmount,
      target_date: form.target_date.value || null,
      status: completed ? 'completed' : 'active'
    });
    if (error) throw error;

    form.reset();
    form.current_amount.value = '0';
    closeGoalModal();
    toast(completed ? 'Meta criada como concluída.' : 'Meta criada.', 'success');
    await loadGoals();
  } catch (error) {
    toast(error.message || 'Não foi possível criar a meta.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function addContribution(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const goal = goals.find((item) => item.id === form.goal_id.value);
  const amount = Number(form.amount.value);

  if (!goal) return toast('Meta não encontrada.', 'error');
  if (!Number.isFinite(amount) || amount <= 0) return toast('Informe um valor maior que zero.', 'error');

  const newAmount = Number(goal.current_amount) + amount;
  const newStatus = newAmount >= Number(goal.target_amount) ? 'completed' : goal.status;
  setButtonLoading(button, true);

  try {
    const { error } = await client.from('goals').update({
      current_amount: newAmount,
      status: newStatus
    }).eq('id', goal.id).eq('financial_space_id', state.currentSpace.id);
    if (error) throw error;

    closeContributionModal();
    toast(newStatus === 'completed' ? 'Meta alcançada. Parabéns!' : 'Progresso registrado.', 'success');
    await loadGoals();
  } catch (error) {
    toast(error.message || 'Não foi possível registrar o progresso.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function changeGoalStatus(goal, status, message) {
  const update = { status };
  if (status === 'completed' && Number(goal.current_amount) < Number(goal.target_amount)) {
    update.current_amount = Number(goal.target_amount);
  }
  if (status === 'cancelled') update.deleted_at = new Date().toISOString();

  const { error } = await client.from('goals').update(update)
    .eq('id', goal.id)
    .eq('financial_space_id', state.currentSpace.id);
  if (error) throw error;
  toast(message, 'success');
  await loadGoals();
}

async function handleGoalAction(button) {
  if (!canEdit()) return toast('Seu perfil neste espaço possui somente visualização.', 'error');
  const goal = goals.find((item) => item.id === button.dataset.goalId);
  if (!goal) return;

  const action = button.dataset.goalAction;
  if (action === 'contribute') return openContributionModal(goal);
  if (action === 'pause') return changeGoalStatus(goal, 'paused', 'Meta pausada.');
  if (action === 'resume') return changeGoalStatus(goal, 'active', 'Meta retomada.');
  if (action === 'complete') {
    if (!confirm('Marcar esta meta como concluída e considerar o valor total alcançado?')) return;
    return changeGoalStatus(goal, 'completed', 'Meta concluída.');
  }
  if (action === 'archive') {
    if (!confirm('Arquivar esta meta? Ela deixará de aparecer na lista.')) return;
    return changeGoalStatus(goal, 'cancelled', 'Meta arquivada.');
  }
}

initApp().then(async (ctx) => {
  client = ctx.client;
  state = ctx.state;

  const newButton = document.querySelector('[data-new-goal]');
  if (!canEdit()) {
    newButton.hidden = true;
  } else {
    newButton.addEventListener('click', openGoalModal);
  }

  document.querySelectorAll('[data-goal-close]').forEach((button) => button.addEventListener('click', closeGoalModal));
  document.querySelectorAll('[data-contribution-close]').forEach((button) => button.addEventListener('click', closeContributionModal));
  document.querySelector('[data-goal-form]').addEventListener('submit', createGoal);
  document.querySelector('[data-contribution-form]').addEventListener('submit', addContribution);
  document.querySelector('[data-goals-grid]').addEventListener('click', (event) => {
    const button = event.target.closest('[data-goal-action]');
    if (!button) return;
    handleGoalAction(button).catch((error) => toast(error.message, 'error'));
  });

  await loadGoals();
}).catch((error) => {
  console.error(error);
  toast(error.message || 'Não foi possível carregar as metas.', 'error');
});
