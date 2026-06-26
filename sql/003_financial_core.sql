begin;

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  financial_space_id uuid not null references public.financial_spaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  type public.account_type not null default 'checking',
  institution text,
  initial_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  include_in_projection boolean not null default true,
  status public.space_status not null default 'active',
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, financial_space_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  financial_space_id uuid not null references public.financial_spaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  type public.category_type not null,
  color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text,
  is_system boolean not null default false,
  status public.space_status not null default 'active',
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, financial_space_id),
  unique (financial_space_id, name, type)
);

create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  financial_space_id uuid not null references public.financial_spaces(id) on delete cascade,
  account_id uuid not null,
  category_id uuid,
  description text not null check (char_length(trim(description)) between 2 and 140),
  type public.transaction_type not null check (type <> 'transfer'),
  amount numeric(14,2) not null check (amount > 0),
  frequency public.recurrence_frequency not null,
  interval_count integer not null default 1 check (interval_count between 1 and 60),
  start_date date not null,
  end_date date,
  status public.space_status not null default 'active',
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (account_id, financial_space_id) references public.accounts(id, financial_space_id),
  foreign key (category_id, financial_space_id) references public.categories(id, financial_space_id),
  check (end_date is null or end_date >= start_date)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  financial_space_id uuid not null references public.financial_spaces(id) on delete cascade,
  account_id uuid not null,
  destination_account_id uuid,
  category_id uuid,
  recurring_transaction_id uuid references public.recurring_transactions(id),
  description text not null check (char_length(trim(description)) between 2 and 140),
  type public.transaction_type not null,
  amount numeric(14,2) not null check (amount > 0),
  effective_date date not null,
  due_date date,
  status public.transaction_status not null default 'planned',
  notes text,
  is_shared boolean not null default false,
  created_by uuid not null default auth.uid() references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (account_id, financial_space_id) references public.accounts(id, financial_space_id),
  foreign key (destination_account_id, financial_space_id) references public.accounts(id, financial_space_id),
  foreign key (category_id, financial_space_id) references public.categories(id, financial_space_id),
  check (type <> 'transfer' or destination_account_id is not null),
  check (destination_account_id is null or destination_account_id <> account_id)
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  financial_space_id uuid not null references public.financial_spaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  target_date date,
  status public.goal_status not null default 'active',
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique default ('LGPD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  user_id uuid references public.profiles(id),
  financial_space_id uuid references public.financial_spaces(id),
  request_type text not null check (request_type in ('access','correction','deletion','anonymization','portability','revoke_consent')),
  description text,
  status text not null default 'open' check (status in ('open','in_review','approved','rejected','completed')),
  decision text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  financial_space_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index accounts_space_idx on public.accounts(financial_space_id, status) where deleted_at is null;
create index categories_space_idx on public.categories(financial_space_id, type, status);
create index transactions_space_date_idx on public.transactions(financial_space_id, effective_date desc) where deleted_at is null;
create index transactions_space_status_idx on public.transactions(financial_space_id, status) where deleted_at is null;
create index recurring_space_idx on public.recurring_transactions(financial_space_id, status) where deleted_at is null;
create index goals_space_idx on public.goals(financial_space_id, status) where deleted_at is null;
create index audit_logs_space_date_idx on public.audit_logs(financial_space_id, created_at desc);

create trigger accounts_set_updated_at before update on public.accounts for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger recurring_set_updated_at before update on public.recurring_transactions for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions for each row execute function public.set_updated_at();
create trigger goals_set_updated_at before update on public.goals for each row execute function public.set_updated_at();

create or replace function public.sync_account_balance_from_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_source_delta numeric(14,2) := 0;
  new_source_delta numeric(14,2) := 0;
begin
  if tg_op in ('UPDATE','DELETE') and old.status = 'paid' and old.deleted_at is null then
    old_source_delta := case old.type
      when 'income' then old.amount
      when 'expense' then -old.amount
      when 'transfer' then -old.amount
      else 0
    end;

    update public.accounts
       set current_balance = current_balance - old_source_delta
     where id = old.account_id and financial_space_id = old.financial_space_id;

    if old.type = 'transfer' and old.destination_account_id is not null then
      update public.accounts
         set current_balance = current_balance - old.amount
       where id = old.destination_account_id and financial_space_id = old.financial_space_id;
    end if;
  end if;

  if tg_op in ('INSERT','UPDATE') and new.status = 'paid' and new.deleted_at is null then
    new_source_delta := case new.type
      when 'income' then new.amount
      when 'expense' then -new.amount
      when 'transfer' then -new.amount
      else 0
    end;

    update public.accounts
       set current_balance = current_balance + new_source_delta
     where id = new.account_id and financial_space_id = new.financial_space_id;

    if new.type = 'transfer' and new.destination_account_id is not null then
      update public.accounts
         set current_balance = current_balance + new.amount
       where id = new.destination_account_id and financial_space_id = new.financial_space_id;
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger transactions_sync_account_balance
  after insert or update or delete on public.transactions
  for each row execute function public.sync_account_balance_from_transaction();

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_json jsonb;
  new_json jsonb;
  record_json jsonb;
  space_id uuid;
  record_id uuid;
begin
  if tg_op <> 'INSERT' then old_json := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then new_json := to_jsonb(new); end if;
  record_json := coalesce(new_json, old_json);

  if tg_table_name = 'financial_spaces' then
    space_id := nullif(record_json->>'id','')::uuid;
  else
    space_id := nullif(record_json->>'financial_space_id','')::uuid;
  end if;
  record_id := nullif(record_json->>'id','')::uuid;

  insert into public.audit_logs(user_id, financial_space_id, action, entity, entity_id, old_data, new_data)
  values (auth.uid(), space_id, lower(tg_op), tg_table_name, record_id, old_json, new_json);

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger audit_accounts after insert or update or delete on public.accounts for each row execute function public.audit_row_change();
create trigger audit_categories after insert or update or delete on public.categories for each row execute function public.audit_row_change();
create trigger audit_transactions after insert or update or delete on public.transactions for each row execute function public.audit_row_change();
create trigger audit_recurring after insert or update or delete on public.recurring_transactions for each row execute function public.audit_row_change();
create trigger audit_goals after insert or update or delete on public.goals for each row execute function public.audit_row_change();
create trigger audit_space_members after insert or update or delete on public.space_members for each row execute function public.audit_row_change();

commit;
