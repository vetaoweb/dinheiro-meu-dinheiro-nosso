-- SOMENTE LEITURA: execute após sql/010_auth_onboarding_repair.sql.

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'ensure_user_workspace';

select
  trigger_name,
  event_object_schema,
  event_object_table
from information_schema.triggers
where event_object_schema = 'auth'
  and event_object_table = 'users'
  and trigger_name = 'on_auth_user_created';

select
  p.proname as funcao,
  p.prosecdef as security_definer,
  pg_get_function_identity_arguments(p.oid) as argumentos
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'ensure_user_workspace';

select
  has_function_privilege('authenticated', 'public.ensure_user_workspace()', 'EXECUTE') as authenticated_pode_executar,
  has_function_privilege('anon', 'public.ensure_user_workspace()', 'EXECUTE') as anon_pode_executar;
