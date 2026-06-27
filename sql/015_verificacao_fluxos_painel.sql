-- SOMENTE LEITURA: execute após sql/014_restore_create_financial_space.sql.

with expected_functions(name, signature) as (
  values
    ('ensure_user_workspace', 'public.ensure_user_workspace()'),
    ('create_financial_space', 'public.create_financial_space(text,public.space_type)'),
    ('get_12_month_projection', 'public.get_12_month_projection(uuid,date)'),
    ('create_space_invitation', 'public.create_space_invitation(uuid,text,public.member_role)'),
    ('get_invitation_preview', 'public.get_invitation_preview(uuid)'),
    ('accept_space_invitation', 'public.accept_space_invitation(uuid)'),
    ('cancel_space_invitation', 'public.cancel_space_invitation(uuid)'),
    ('get_space_members', 'public.get_space_members(uuid)'),
    ('get_space_invitations', 'public.get_space_invitations(uuid)'),
    ('get_my_pending_invitations', 'public.get_my_pending_invitations()')
)
select
  name as funcao,
  to_regprocedure(signature) is not null as existe,
  case
    when name = 'get_invitation_preview'
      then has_function_privilege('anon', signature, 'EXECUTE')
    else has_function_privilege('authenticated', signature, 'EXECUTE')
  end as papel_correto_pode_executar
from expected_functions
order by name;

select
  c.relname as tabela,
  c.relrowsecurity as rls_ativo,
  count(p.policyname) as politicas
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
  on p.schemaname = n.nspname
 and p.tablename = c.relname
where n.nspname = 'public'
  and c.relname in (
    'profiles',
    'financial_spaces',
    'space_members',
    'accounts',
    'categories',
    'transactions',
    'recurring_transactions',
    'goals',
    'privacy_requests',
    'audit_logs',
    'space_invitations'
  )
group by c.relname, c.relrowsecurity
order by c.relname;

select
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in (
    'accounts',
    'categories',
    'transactions',
    'recurring_transactions',
    'goals',
    'space_members',
    'space_invitations'
  )
order by event_object_table, trigger_name, event_manipulation;

select
  'funcoes_esperadas' as item,
  count(*) filter (where to_regprocedure(signature) is not null) as encontradas,
  count(*) as esperadas
from (
  values
    ('public.ensure_user_workspace()'),
    ('public.create_financial_space(text,public.space_type)'),
    ('public.get_12_month_projection(uuid,date)'),
    ('public.create_space_invitation(uuid,text,public.member_role)'),
    ('public.get_invitation_preview(uuid)'),
    ('public.accept_space_invitation(uuid)'),
    ('public.cancel_space_invitation(uuid)'),
    ('public.get_space_members(uuid)'),
    ('public.get_space_invitations(uuid)'),
    ('public.get_my_pending_invitations()')
) as f(signature)
union all
select
  'tabelas_com_rls',
  count(*) filter (where c.relrowsecurity),
  count(*)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles',
    'financial_spaces',
    'space_members',
    'accounts',
    'categories',
    'transactions',
    'recurring_transactions',
    'goals',
    'privacy_requests',
    'audit_logs',
    'space_invitations'
  );
