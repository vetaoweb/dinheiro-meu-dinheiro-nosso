begin;

create or replace function public.create_financial_space(
  p_name text,
  p_type public.space_type
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  new_space_id uuid;
  normalized_name text := trim(coalesce(p_name, ''));
begin
  if current_user_id is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  perform public.ensure_user_workspace();

  if p_type is null or p_type not in ('household', 'business') then
    raise exception 'Escolha um espaço familiar ou profissional.' using errcode = '22023';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 80 then
    raise exception 'O nome do espaço deve ter entre 2 e 80 caracteres.' using errcode = '22023';
  end if;

  if (
    select count(*)
    from public.financial_spaces fs
    where fs.created_by = current_user_id
      and fs.deleted_at is null
      and fs.status = 'active'
  ) >= 20 then
    raise exception 'O limite de espaços ativos desta conta foi atingido.' using errcode = '22023';
  end if;

  insert into public.financial_spaces (
    name,
    type,
    created_by
  ) values (
    normalized_name,
    p_type,
    current_user_id
  )
  returning id into new_space_id;

  insert into public.space_members (
    financial_space_id,
    user_id,
    role,
    status,
    joined_at
  ) values (
    new_space_id,
    current_user_id,
    'owner',
    'active',
    now()
  );

  perform public.seed_space_defaults(new_space_id, current_user_id);

  return new_space_id;
exception
  when others then
    raise;
end;
$$;

revoke all on function public.create_financial_space(text, public.space_type) from public;
revoke execute on function public.create_financial_space(text, public.space_type) from anon;
revoke execute on function public.create_financial_space(text, public.space_type) from service_role;
grant execute on function public.create_financial_space(text, public.space_type) to authenticated;

commit;

notify pgrst, 'reload schema';

select
  to_regprocedure('public.create_financial_space(text,public.space_type)') as funcao,
  has_function_privilege('authenticated', 'public.create_financial_space(text,public.space_type)', 'EXECUTE') as authenticated_pode_executar,
  has_function_privilege('anon', 'public.create_financial_space(text,public.space_type)', 'EXECUTE') as anon_pode_executar;
