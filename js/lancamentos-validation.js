import { toast } from './ui.js';

function numericValue(form, name) {
  return Number(String(new FormData(form).get(name) || '').replace(',', '.'));
}

function validateTransaction(form) {
  const data = new FormData(form);
  const description = String(data.get('description') || '').trim();
  const amount = numericValue(form, 'amount');
  const type = String(data.get('type') || '');
  const source = String(data.get('account_id') || '');
  const destination = String(data.get('destination_account_id') || '');

  if (document.body.classList.contains('is-readonly-space')) return 'Seu perfil possui somente visualização neste espaço.';
  if (description.length < 2) return 'Informe uma descrição válida.';
  if (!Number.isFinite(amount) || amount <= 0) return 'Informe um valor maior que zero.';
  if (!source) return 'Selecione a conta de origem.';
  if (!data.get('effective_date')) return 'Informe a data do lançamento.';
  if (type === 'transfer' && !destination) return 'Selecione a conta de destino.';
  if (type === 'transfer' && destination === source) return 'A conta de destino deve ser diferente da conta de origem.';
  return '';
}

function validateRecurring(form) {
  const data = new FormData(form);
  const description = String(data.get('description') || '').trim();
  const amount = numericValue(form, 'amount');
  const interval = Number(data.get('interval_count'));
  const startDate = String(data.get('start_date') || '');
  const endDate = String(data.get('end_date') || '');

  if (document.body.classList.contains('is-readonly-space')) return 'Seu perfil possui somente visualização neste espaço.';
  if (description.length < 2) return 'Informe uma descrição válida.';
  if (!Number.isFinite(amount) || amount <= 0) return 'Informe um valor maior que zero.';
  if (!data.get('account_id')) return 'Selecione uma conta.';
  if (!Number.isInteger(interval) || interval < 1 || interval > 60) return 'O intervalo deve ficar entre 1 e 60.';
  if (!startDate) return 'Informe a data inicial.';
  if (endDate && endDate < startDate) return 'A data final não pode ser anterior à data inicial.';
  return '';
}

function interceptSubmit(selector, validator) {
  const form = document.querySelector(selector);
  form?.addEventListener('submit', (event) => {
    const error = validator(form);
    if (!error) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toast(error, 'error');
  }, true);
}

function interceptOpen(selector, accountSelector) {
  document.querySelector(selector)?.addEventListener('click', (event) => {
    if (document.body.classList.contains('is-readonly-space')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toast('Seu perfil possui somente visualização neste espaço.', 'error');
      return;
    }

    const account = document.querySelector(accountSelector)?.value;
    if (!account) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toast('Cadastre uma conta antes de continuar.', 'error');
    }
  }, true);
}

interceptSubmit('[data-transaction-form]', validateTransaction);
interceptSubmit('[data-recurring-form]', validateRecurring);
interceptOpen('[data-new-transaction]', '#transaction-account');
interceptOpen('[data-new-recurring]', '#recurring-account');
