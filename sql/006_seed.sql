begin;

create or replace function public.seed_space_defaults(
  p_space_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.accounts
    where financial_space_id = p_space_id and deleted_at is null
  ) then
    insert into public.accounts (
      financial_space_id, name, type, initial_balance, current_balance, created_by
    ) values (
      p_space_id, 'Conta principal', 'checking', 0, 0, p_user_id
    );
  end if;

  insert into public.categories (financial_space_id, name, type, color, icon, is_system, created_by)
  values
    (p_space_id, 'Renda', 'income', '#3B9B6B', 'arrow-down', true, p_user_id),
    (p_space_id, 'Moradia', 'expense', '#294B63', 'home', true, p_user_id),
    (p_space_id, 'Alimentação', 'expense', '#C99A3D', 'utensils', true, p_user_id),
    (p_space_id, 'Transporte', 'expense', '#557A8C', 'car', true, p_user_id),
    (p_space_id, 'Saúde', 'expense', '#B54D4A', 'heart', true, p_user_id),
    (p_space_id, 'Educação', 'expense', '#6D739E', 'book', true, p_user_id),
    (p_space_id, 'Lazer', 'expense', '#B8784E', 'smile', true, p_user_id),
    (p_space_id, 'Dívidas', 'expense', '#8D3D3A', 'alert', true, p_user_id),
    (p_space_id, 'Impostos', 'expense', '#59635E', 'file', true, p_user_id),
    (p_space_id, 'Outras despesas', 'expense', '#7C837F', 'more', true, p_user_id),
    (p_space_id, 'Reserva de emergência', 'saving', '#086647', 'shield', true, p_user_id),
    (p_space_id, 'Investimentos', 'saving', '#1B3547', 'trending-up', true, p_user_id)
  on conflict (financial_space_id, name, type) do nothing;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_space_id uuid;
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (
    id, full_name, email, whatsapp, accepted_terms_at, accepted_privacy_at
  ) values (
    new.id,
    v_name,
    new.email,
    nullif(trim(new.raw_user_meta_data->>'whatsapp'), ''),
    now(),
    now()
  );

  insert into public.financial_spaces (name, type, created_by)
  values ('Meu dinheiro', 'personal', new.id)
  returning id into v_space_id;

  insert into public.space_members (
    financial_space_id, user_id, role, status, joined_at
  ) values (
    v_space_id, new.id, 'owner', 'active', now()
  );

  perform public.seed_space_defaults(v_space_id, new.id);
  return new;
end;
$$;

create or replace function public.create_financial_space(
  p_name text,
  p_type public.space_type
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_space_id uuid;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  if p_type = 'personal' then
    raise exception 'Espaços pessoais são criados automaticamente.';
  end if;

  if char_length(trim(p_name)) < 2 then
    raise exception 'Informe um nome válido para o espaço.';
  end if;

  insert into public.financial_spaces (name, type, created_by)
  values (trim(p_name), p_type, v_user_id)
  returning id into v_space_id;

  insert into public.space_members (
    financial_space_id, user_id, role, status, joined_at
  ) values (
    v_space_id, v_user_id, 'owner', 'active', now()
  );

  perform public.seed_space_defaults(v_space_id, v_user_id);
  return v_space_id;
end;
$$;

-- Preenche espaços existentes, inclusive os criados durante a aplicação das migrations.
do $$
declare
  item record;
begin
  for item in
    select id, created_by from public.financial_spaces where deleted_at is null
  loop
    perform public.seed_space_defaults(item.id, item.created_by);
  end loop;
end;
$$;

revoke all on function public.seed_space_defaults(uuid, uuid) from public;
revoke all on function public.create_financial_space(text, public.space_type) from public;
grant execute on function public.create_financial_space(text, public.space_type) to authenticated;

commit;
