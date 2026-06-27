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
    select 1
    from public.accounts
    where financial_space_id = p_space_id
      and deleted_at is null
  ) then
    insert into public.accounts (
      financial_space_id,
      name,
      type,
      initial_balance,
      current_balance,
      created_by
    ) values (
      p_space_id,
      'Conta principal',
      'checking',
      0,
      0,
      p_user_id
    );
  end if;

  insert into public.categories (
    financial_space_id,
    name,
    type,
    color,
    icon,
    is_system,
    created_by
  ) values
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

revoke all on function public.seed_space_defaults(uuid, uuid) from public;
revoke execute on function public.seed_space_defaults(uuid, uuid) from anon;
revoke execute on function public.seed_space_defaults(uuid, uuid) from authenticated;
revoke execute on function public.seed_space_defaults(uuid, uuid) from service_role;

commit;

select to_regprocedure('public.seed_space_defaults(uuid,uuid)') as funcao_restaurada;
