import { initApp } from './app-shell.js';
import { escapeHtml, formatMoney, formatMonth, toast } from './ui.js';

function renderSummary(rows) {
  const minBalance = rows.length ? Math.min(...rows.map((row) => Number(row.closing_balance || 0))) : 0;
  const risk = rows.filter((row) => Number(row.closing_balance || 0) < 0);
  const totalSavings = rows.reduce((sum, row) => sum + Number(row.savings || 0), 0);
  document.querySelector('[data-thermo-min]').textContent = formatMoney(minBalance);
  document.querySelector('[data-thermo-risk]').textContent = String(risk.length);
  document.querySelector('[data-thermo-savings]').textContent = formatMoney(totalSavings);
}

function renderTable(rows) {
  const body = document.querySelector('[data-thermo-body]');
  const empty = document.querySelector('[data-thermo-empty]');
  if (!rows.length) {
    body.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  body.innerHTML = rows.map((row) => {
    const balance = Number(row.closing_balance || 0);
    return `<tr>
      <td>${escapeHtml(formatMonth(row.month_start))}</td>
      <td class="money text-positive">${formatMoney(row.income)}</td>
      <td class="money text-negative">${formatMoney(row.expense)}</td>
      <td class="money">${formatMoney(row.savings)}</td>
      <td class="money">${formatMoney(row.net_cash_flow)}</td>
      <td class="money"><span class="balance-cell"><i class="balance-dot ${balance < 0 ? 'risk' : ''}"></i>${formatMoney(balance)}</span></td>
      <td>${balance < 0 ? '<span class="badge badge-red">Risco</span>' : Number(row.net_cash_flow) < 0 ? '<span class="badge badge-gold">Atenção</span>' : '<span class="badge badge-green">Saudável</span>'}</td>
    </tr>`;
  }).join('');
}

function renderChart(rows) {
  const chart = document.querySelector('[data-thermo-chart]');
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

async function loadProjection(client, space) {
  const startInput = document.querySelector('[data-start-month]');
  const start = startInput.value ? `${startInput.value}-01` : new Date().toISOString().slice(0, 10);
  const { data, error } = await client.rpc('get_12_month_projection', {
    p_space_id: space.id,
    p_start_month: start
  });
  if (error) throw error;
  const rows = data ?? [];
  renderSummary(rows);
  renderTable(rows);
  renderChart(rows);
}

initApp().then(({ client, state }) => {
  if (!state.currentSpace) return;
  const input = document.querySelector('[data-start-month]');
  input.value = new Date().toISOString().slice(0, 7);
  document.querySelector('[data-refresh-projection]')?.addEventListener('click', () => loadProjection(client, state.currentSpace).catch((error) => toast(error.message, 'error')));
  loadProjection(client, state.currentSpace).catch((error) => toast(error.message, 'error'));
}).catch(console.error);
