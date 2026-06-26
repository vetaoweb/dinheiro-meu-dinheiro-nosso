begin;

alter table public.recurring_transactions
  add constraint recurring_transactions_id_space_unique
  unique (id, financial_space_id);

alter table public.transactions
  drop constraint if exists transactions_recurring_transaction_id_fkey;

alter table public.transactions
  add constraint transactions_recurring_space_fkey
  foreign key (recurring_transaction_id, financial_space_id)
  references public.recurring_transactions(id, financial_space_id);

create or replace function public.preserve_financial_record_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.financial_space_id := old.financial_space_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger accounts_preserve_identity
  before update on public.accounts
  for each row execute function public.preserve_financial_record_identity();

create trigger categories_preserve_identity
  before update on public.categories
  for each row execute function public.preserve_financial_record_identity();

create trigger transactions_preserve_identity
  before update on public.transactions
  for each row execute function public.preserve_financial_record_identity();

create trigger recurring_preserve_identity
  before update on public.recurring_transactions
  for each row execute function public.preserve_financial_record_identity();

create trigger goals_preserve_identity
  before update on public.goals
  for each row execute function public.preserve_financial_record_identity();

create or replace function public.preserve_space_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.type := old.type;
  return new;
end;
$$;

create trigger spaces_preserve_identity
  before update on public.financial_spaces
  for each row execute function public.preserve_space_identity();

create or replace function public.preserve_membership_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.financial_space_id := old.financial_space_id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger members_preserve_identity
  before update on public.space_members
  for each row execute function public.preserve_membership_identity();

create or replace function public.protect_last_space_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  remaining_owners integer;
begin
  if old.role = 'owner' and old.status = 'active' and (
    tg_op = 'DELETE' or
    new.role <> 'owner' or
    new.status <> 'active'
  ) then
    select count(*)
      into remaining_owners
      from public.space_members sm
     where sm.financial_space_id = old.financial_space_id
       and sm.user_id <> old.user_id
       and sm.role = 'owner'
       and sm.status = 'active';

    if remaining_owners = 0 then
      raise exception 'O espaço financeiro precisa manter ao menos um proprietário.';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger members_protect_last_owner
  before update or delete on public.space_members
  for each row execute function public.protect_last_space_owner();

create or replace function public.set_transaction_updated_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger transactions_set_updated_by
  before update on public.transactions
  for each row execute function public.set_transaction_updated_by();

commit;
