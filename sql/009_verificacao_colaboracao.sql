-- SOMENTE LEITURA: execute após sql/008_collaboration.sql.

select
  c.relname as tabela,
  c.relrowsecurity as rls_ativo
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'space_invitations';

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'create_space_invitation',
    'get_invitation_preview',
    'accept_space_invitation',
    'cancel_space_invitation',
    'get_space_members',
    'get_space_invitations',
    'get_my_pending_invitations'
  )
order by routine_name;

select
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'space_invitations'
order by trigger_name, event_manipulation;

select
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'space_invitations'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

select
  'tabela_convites' as item,
  count(*) as total
from information_schema.tables
where table_schema = 'public'
  and table_name = 'space_invitations'
union all
select
  'funcoes_colaboracao',
  count(*)
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'create_space_invitation',
    'get_invitation_preview',
    'accept_space_invitation',
    'cancel_space_invitation',
    'get_space_members',
    'get_space_invitations',
    'get_my_pending_invitations'
  );
