import { initApp } from './app-shell.js';
import { escapeHtml, formatDate, formatMoney, setButtonLoading, toast } from './ui.js';

let client;
let space;
let categories = [];

function openModal() {
  document.querySelector('[data-modal]')?.classList.remove('hidden');
  document.querySelector('#transaction-description')?.focus();
}
function closeModal() {
  document.querySelector('[data-modal]')?.classList.add('hidden');
}
function openRecurringModal() {
  document.querySelector('[data-recurring-modal]')?.classList.remove('hidden');
  document.querySelector('#recurring-description')?.focus();
}
function closeRecurringModal() {
  document.querySelector('[data-recurring-modal]')?.classList.add('hidden');
}

function typeLabel(type) {
  return ({ income: 'Entrada', expense: 'Saída', saving: 'Economia', transfer: 'Transferência' })[type] || type;
}

async function loadCategories() {
  const { data, error } = await client.from('categories').select('id, name, type').eq('financial_space_id', space.id).eq('status', 'active').order('name');
  if (error) throw error;
  categories = data ?? [];
  updateCategoryOptions();
}

function updateCategoryOptions() {
  const type = document.querySelector('#transaction-type')?.value || 'expense';
  const select = document.querySelector('#transaction-category');
  if (!select) return;
  select.disabled = type === 'transfer';
  select.innerHTML = '<option value="">Sem categoria</option>' + categories
    .filter((category) => category.type === type || category.type === 'both')
    .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
    .join('');
  const destinationField = document.querySelector('[data-destination-field]');
  const destination = document.querySelector('#transaction-destination');
  const isTransfer = type === 'transfer';
  destinationField?.classList.toggle('hidden', !isTransfer);
  if (destination) destination.required = isTransfer;

  const recurringType = document.querySelector('#recurring-type')?.value || 'expense';
  const recurringCategory = document.querySelector('#recurring-category');
  if (recurringCategory) {
    recurringCategory.innerHTML = '<option value="">Sem categoria</option>' + categories
      .filter((category) => category.type === recurringType || category.type === 'both')
      .map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`)
      .join('');
  }
}

async function loadTransactions() {
  const body = document.querySelector('[data-transactions-body]');
  const empty = document.querySelector('[data-transactions-empty]');
  const { data, error } = await client
    .from('transactions')
    .select('id, description, type, amount, effective_date, status, categories(name), accounts(name)')
    .eq('financial_space_id', space.id)
    .is('deleted_at', null)
    .order('effective_date', { ascending: false })
    .limit(100);
  if (error) throw error;
  if (!data?.length) {
    body.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  body.innerHTML = data.map((row) => `<tr>
    <td>${formatDate(row.effective_date)}</td>
    <td>${escapeHtml(row.description)}</td>
    <td>${escapeHtml(row.categories?.name || 'Sem categoria')}</td>
    <td><span class="badge ${row.type === 'income' ? 'badge-green' : row.type === 'expense' ? 'badge-red' : 'badge-blue'}">${typeLabel(row.type)}</span></td>
    <td class="money">${formatMoney(row.amount)}</td>
    <td><button class="btn btn-ghost" type="button" data-delete="${row.id}">Excluir</button></td>
  </tr>`).join('');
}

async function loadAccounts() {
  const { data, error } = await client.from('accounts').select('id, name').eq('financial_space_id', space.id).eq('status', 'active').order('name');
  if (error) throw error;
  const options = (data ?? []).map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
  const source = document.querySelector('#transaction-account');
  const destination = document.querySelector('#transaction-destination');
  const recurringAccount = document.querySelector('#recurring-account');
  source.innerHTML = options || '<option value="">Cadastre uma conta</option>';
  destination.innerHTML = '<option value="">Selecione</option>' + options;
  if (recurringAccount) recurringAccount.innerHTML = options || '<option value="">Cadastre uma conta</option>';
}

function frequencyLabel(value, interval) {
  const base = ({ weekly: 'semana', monthly: 'mês', yearly: 'ano' })[value] || value;
  return Number(interval) === 1 ? `Todo ${base}` : `A cada ${interval} ${base}${Number(interval) > 1 ? 'es' : ''}`;
}

async function loadRecurring() {
  const body = document.querySelector('[data-recurring-body]');
  const empty = document.querySelector('[data-recurring-empty]');
  const { data, error } = await client
    .from('recurring_transactions')
    .select('id, description, type, amount, frequency, interval_count, start_date')
    .eq('financial_space_id', space.id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('start_date', { ascending: true });
  if (error) throw error;
  if (!data?.length) {
    body.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  body.innerHTML = data.map((row) => `<tr>
    <td>${escapeHtml(row.description)}</td>
    <td><span class="badge ${row.type === 'income' ? 'badge-green' : row.type === 'expense' ? 'badge-red' : 'badge-blue'}">${typeLabel(row.type)}</span></td>
    <td>${escapeHtml(frequencyLabel(row.frequency, row.interval_count))}</td>
    <td>${formatDate(row.start_date)}</td>
    <td class="money">${formatMoney(row.amount)}</td>
    <td><button class="btn btn-ghost" type="button" data-delete-recurring="${row.id}">Excluir</button></td>
  </tr>`).join('');
}

async function saveRecurring(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const amount = Number(String(data.get('amount')).replace(',', '.'));
  setButtonLoading(button, true);
  try {
    const { error } = await client.from('recurring_transactions').insert({
      financial_space_id: space.id,
      account_id: data.get('account_id'),
      category_id: data.get('category_id') || null,
      description: String(data.get('description')).trim(),
      type: data.get('type'),
      amount,
      frequency: data.get('frequency'),
      interval_count: Number(data.get('interval_count')),
      start_date: data.get('start_date'),
      end_date: data.get('end_date') || null
    });
    if (error) throw error;
    form.reset();
    document.querySelector('#recurring-interval').value = '1';
    document.querySelector('#recurring-start').value = new Date().toISOString().slice(0, 10);
    closeRecurringModal();
    toast('Recorrência salva.', 'success');
    await loadRecurring();
  } catch (error) {
    toast(error.message || 'Não foi possível salvar a recorrência.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function deleteRecurring(id) {
  if (!confirm('Excluir esta recorrência?')) return;
  const { error } = await client.from('recurring_transactions').update({ deleted_at: new Date().toISOString(), status: 'archived' }).eq('id', id).eq('financial_space_id', space.id);
  if (error) return toast(error.message, 'error');
  toast('Recorrência excluída.', 'success');
  loadRecurring();
}

async function saveTransaction(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  const amount = Number(String(data.get('amount')).replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return toast('Informe um valor maior que zero.', 'error');

  setButtonLoading(button, true);
  try {
    const { error } = await client.from('transactions').insert({
      financial_space_id: space.id,
      account_id: data.get('account_id'),
      destination_account_id: data.get('type') === 'transfer' ? (data.get('destination_account_id') || null) : null,
      category_id: data.get('type') === 'transfer' ? null : (data.get('category_id') || null),
      description: String(data.get('description')).trim(),
      type: data.get('type'),
      amount,
      effective_date: data.get('effective_date'),
      status: data.get('status'),
      notes: String(data.get('notes') || '').trim() || null
    });
    if (error) throw error;
    form.reset();
    document.querySelector('#transaction-effective-date').value = new Date().toISOString().slice(0, 10);
    closeModal();
    toast('Lançamento salvo.', 'success');
    await loadTransactions();
  } catch (error) {
    toast(error.message || 'Não foi possível salvar.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
}

async function deleteTransaction(id) {
  if (!confirm('Excluir este lançamento? O registro será ocultado, preservando a auditoria.')) return;
  const { error } = await client.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('financial_space_id', space.id);
  if (error) return toast(error.message, 'error');
  toast('Lançamento excluído.', 'success');
  loadTransactions();
}

initApp().then(async (ctx) => {
  client = ctx.client;
  space = ctx.state.currentSpace;
  if (!space) return;
  document.querySelector('[data-new-transaction]')?.addEventListener('click', openModal);
  document.querySelector('[data-new-recurring]')?.addEventListener('click', openRecurringModal);
  document.querySelectorAll('[data-modal-close]').forEach((button) => button.addEventListener('click', closeModal));
  document.querySelectorAll('[data-recurring-close]').forEach((button) => button.addEventListener('click', closeRecurringModal));
  document.querySelector('#transaction-type')?.addEventListener('change', updateCategoryOptions);
  document.querySelector('#recurring-type')?.addEventListener('change', updateCategoryOptions);
  document.querySelector('[data-transaction-form]')?.addEventListener('submit', saveTransaction);
  document.querySelector('[data-recurring-form]')?.addEventListener('submit', saveRecurring);
  document.querySelector('[data-transactions-body]')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete]');
    if (button) deleteTransaction(button.dataset.delete);
  });
  document.querySelector('[data-recurring-body]')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-recurring]');
    if (button) deleteRecurring(button.dataset.deleteRecurring);
  });
  document.querySelector('#transaction-effective-date').value = new Date().toISOString().slice(0, 10);
  document.querySelector('#recurring-start').value = new Date().toISOString().slice(0, 10);
  await Promise.all([loadCategories(), loadAccounts(), loadTransactions(), loadRecurring()]);
}).catch(console.error);
