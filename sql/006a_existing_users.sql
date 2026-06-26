begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  space_id uuid;
  display_name text;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (
    id, full_name, email, whatsapp, accepted_terms_at, accepted_privacy_at
  ) values (
    new.id,
    display_name,
    new.email,
    nullif(trim(new.raw_user_meta_data->>'whatsapp'), ''),
    now(),
    now()
  );

  insert into public.financial_spaces (name, type, created_by)
  values ('Meu dinheiro', 'personal', new.id)
  returning id into space_id;

  insert into public.space_members (
    financial_space_id, user_id, role, status, joined_at
  ) values (
    space_id, new.id, 'owner', 'active', now()
  );

  perform public.seed_space_defaults(space_id, new.id);
  return new;
end;
$$;

-- Preenche usuários que já existiam no módulo de autenticação.
do $$
declare
  item record;
  space_id uuid;
begin
  for item in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null and u.email is not null
  loop
    insert into public.profiles (id, full_name, email, whatsapp)
    values (
      item.id,
      coalesce(nullif(trim(item.raw_user_meta_data->>'full_name'), ''), split_part(item.email, '@', 1)),
      item.email,
      nullif(trim(item.raw_user_meta_data->>'whatsapp'), '')
    );

    insert into public.financial_spaces (name, type, created_by)
    values ('Meu dinheiro', 'personal', item.id)
    returning id into space_id;

    insert into public.space_members (financial_space_id, user_id, role, status, joined_at)
    values (space_id, item.id, 'owner', 'active', now());

    perform public.seed_space_defaults(space_id, item.id);
  end loop;
end;
$$;

commit;
