begin;

-- O cadastro no Supabase Auth não deve depender de várias inserções em uma trigger.
-- A estrutura financeira passa a ser criada de forma idempotente após a autenticação.
drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.ensure_user_workspace()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  auth_record auth.users%rowtype;
  personal_space_id uuid;
  display_name text;
  accepted_terms timestamptz;
  accepted_privacy timestamptz;
begin
  if current_user_id is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  select *
    into auth_record
    from auth.users
   where id = current_user_id;

  if not found or auth_record.email is null then
    raise exception 'Usuário autenticado não encontrado.' using errcode = '42501';
  end if;

  display_name := coalesce(
    nullif(trim(auth_record.raw_user_meta_data->>'full_name'), ''),
    split_part(auth_record.email, '@', 1)
  );

  if coalesce((auth_record.raw_user_meta_data->>'terms_accepted')::boolean, false) then
    accepted_terms := now();
  end if;

  if coalesce((auth_record.raw_user_meta_data->>'privacy_accepted')::boolean, false) then
    accepted_privacy := now();
  end if;

  insert into public.profiles (
    id,
    full_name,
    email,
    whatsapp,
    accepted_terms_at,
    accepted_privacy_at
  ) values (
    current_user_id,
    display_name,
    lower(auth_record.email),
    nullif(trim(auth_record.raw_user_meta_data->>'whatsapp'), ''),
    accepted_terms,
    accepted_privacy
  )
  on conflict (id) do update set
    email = lower(excluded.email),
    full_name = case
      when nullif(trim(public.profiles.full_name), '') is null then excluded.full_name
      else public.profiles.full_name
    end,
    whatsapp = coalesce(public.profiles.whatsapp, excluded.whatsapp),
    accepted_terms_at = coalesce(public.profiles.accepted_terms_at, excluded.accepted_terms_at),
    accepted_privacy_at = coalesce(public.profiles.accepted_privacy_at, excluded.accepted_privacy_at),
    updated_at = now();

  select fs.id
    into personal_space_id
    from public.financial_spaces fs
    join public.space_members sm
      on sm.financial_space_id = fs.id
     and sm.user_id = current_user_id
   where fs.type = 'personal'
     and fs.created_by = current_user_id
     and fs.deleted_at is null
     and sm.status = 'active'
   order by fs.created_at
   limit 1;

  if personal_space_id is null then
    insert into public.financial_spaces (
      name,
      type,
      created_by
    ) values (
      'Meu dinheiro',
      'personal',
      current_user_id
    )
    returning id into personal_space_id;

    insert into public.space_members (
      financial_space_id,
      user_id,
      role,
      status,
      joined_at
    ) values (
      personal_space_id,
      current_user_id,
      'owner',
      'active',
      now()
    );
  else
    insert into public.space_members (
      financial_space_id,
      user_id,
      role,
      status,
      joined_at
    ) values (
      personal_space_id,
      current_user_id,
      'owner',
      'active',
      now()
    )
    on conflict (financial_space_id, user_id) do update set
      role = 'owner',
      status = 'active',
      joined_at = coalesce(public.space_members.joined_at, now());
  end if;

  perform public.seed_space_defaults(personal_space_id, current_user_id);
  return personal_space_id;
end;
$$;

revoke all on function public.ensure_user_workspace() from public;
grant execute on function public.ensure_user_workspace() to authenticated;

commit;
