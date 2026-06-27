import { initApp } from './app-shell.js';
import { escapeHtml, formatDate, formatMoney, formatMonth, toast } from './ui.js';

function setText(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function renderChart(rows) {
  const chart = document.querySelector('[data-projection-chart]');
  if (!chart) return;
  if (!rows.length) {
    chart.innerHTML = '<div class="empty-state"><strong>Sem projeções</strong>Cadastre lançamentos futuros ou recorrentes.</div>';
    return;
  }

  const max = Math.max(...rows.map((row) => Math.abs(Number(row.closing_balance || 0))), 1);
  chart.innerHTML = rows.map((row) => {
    const balance = Number(row.closing_balance || 0);
    const height = Math.max(3, Math.round((Math.abs(balance) / max) * 100));
    return `<div class="chart-column" style="--bar-height:${height}%">
      <span class="chart-tooltip">${formatMoney(balance)}</span>
      <i class="chart-bar ${balance < 0 ? 'negative' : ''}" style="height:${height}%"></i>
      <span class="chart-label">${formatMonth(row.month_start).split(' ')[0]}</span>
    </div>`;
  }).join('');
}

function renderRecent(rows) {
  const body = document.querySelector('[data-recent-body]');
  const empty = document.querySelector('[data-recent-empty]');
  if (!body || !empty) return;

  if (!rows.length) {
    body.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  body.innerHTML = rows.map((row) => `<tr>
    <td>${formatDate(row.effective_date)}</td>
    <td>${escapeHtml(row.description)}</td>
    <td><span class="badge ${row.type === 'income' ? 'badge-green' : row.type === 'expense' ? 'badge-red' : 'badge-blue'}">${row.type === 'income' ? 'Entrada' : row.type === 'expense' ? 'Saída' : row.type === 'saving' ? 'Economia' : 'Transferência'}</span></td>
    <td class="money ${row.type === 'income' ? 'text-positive' : row.type === 'expense' ? 'text-negative' : ''}">${formatMoney(row.amount)}</td>
  </tr>`).join('');
}

function renderGoals(rows) {
  const list = document.querySelector('[data-dashboard-goals-list]');
  const empty = document.querySelector('[data-dashboard-goals-empty]');
  if (!list || !empty) return;

  const active = rows.filter((goal) => goal.status === 'active').slice(0, 3);
  if (!active.length) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  list.innerHTML = active.map((goal) => {
    const target = Number(goal.target_amount || 0);
    const current = Number(goal.current_amount || 0);
    const progress = target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0;
    return `<article class="dashboard-goal">
      <div class="dashboard-goal-head"><h3>${escapeHtml(goal.name)}</h3><strong>${progress}%</strong></div>
      <div class="dashboard-goal-progress"><i style="width:${progress}%"></i></div>
      <div class="dashboard-goal-foot"><span>${formatMoney(current)}</span><span>de ${formatMoney(target)}</span></div>
    </article>`;
  }).join('');
}

async function loadDashboard(client, space) {
  if (!space) throw new Error('Nenhum espaço financeiro ativo foi encontrado.');

  const [projectionResult, transactionResult, accountResult, goalResult] = await Promise.all([
    client.rpc('get_12_month_projection', {
      p_space_id: space.id,
      p_start_month: new Date().toISOString().slice(0, 10)
    }),
    client
      .from('transactions')
      .select('id, description, type, amount, effective_date, status')
      .eq('financial_space_id', space.id)
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .order('effective_date', { ascending: false })
      .limit(8),
    client
      .from('accounts')
      .select('current_balance')
      .eq('financial_space_id', space.id)
      .eq('status', 'active')
      .is('deleted_at', null),
    client
      .from('goals')
      .select('id, name, target_amount, current_amount, target_date, status')
      .eq('financial_space_id', space.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
  ]);

  if (projectionResult.error) throw projectionResult.error;
  if (transactionResult.error) throw transactionResult.error;
  if (accountResult.error) throw accountResult.error;
  if (goalResult.error) throw goalResult.error;

  const rows = projectionResult.data ?? [];
  const current = rows[0] ?? {};
  const accountsBalance = (accountResult.data ?? []).reduce((sum, item) => sum + Number(item.current_balance || 0), 0);
  const minimum = rows.length ? Math.min(...rows.map((row) => Number(row.closing_balance || 0))) : accountsBalance;
  const riskMonths = rows.filter((row) => Number(row.closing_balance || 0) < 0).length;
  const savings = rows.reduce((sum, row) => sum + Number(row.savings || 0), 0);

  setText('[data-kpi-balance]', formatMoney(accountsBalance));
  setText('[data-kpi-income]', formatMoney(current.income || 0));
  setText('[data-kpi-expense]', formatMoney(current.expense || 0));
  setText('[data-kpi-savings]', formatMoney(current.savings || 0));
  setText('[data-minimum-balance]', formatMoney(minimum));
  setText('[data-risk-months]', String(riskMonths));
  setText('[data-savings-12m]', formatMoney(savings));

  const score = rows.length
    ? Math.max(0, Math.min(100, Math.round(((rows.length - riskMonths) / rows.length) * 100)))
    : 0;
  const gauge = document.querySelector('[data-health-gauge]');
  if (gauge) gauge.style.setProperty('--gauge', `${score}%`);
  setText('[data-health-score]', `${score}%`);
  setText('[data-health-label]', score >= 80 ? 'Trajetória saudável' : score >= 50 ? 'Atenção ao planejamento' : 'Risco financeiro elevado');

  renderChart(rows);
  renderRecent(transactionResult.data ?? []);
  renderGoals(goalResult.data ?? []);
}

initApp()
  .then(({ client, state }) => loadDashboard(client, state.currentSpace))
  .catch((error) => {
    console.error(error);
    toast(error?.message || 'Não foi possível carregar o painel.', 'error');
  });
