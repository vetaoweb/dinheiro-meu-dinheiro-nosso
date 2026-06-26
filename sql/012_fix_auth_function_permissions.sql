begin;

revoke all on function public.ensure_user_workspace() from public;
revoke execute on function public.ensure_user_workspace() from anon;
revoke execute on function public.ensure_user_workspace() from service_role;
grant execute on function public.ensure_user_workspace() to authenticated;

commit;

select
  has_function_privilege('authenticated', 'public.ensure_user_workspace()', 'EXECUTE') as authenticated_pode_executar,
  has_function_privilege('anon', 'public.ensure_user_workspace()', 'EXECUTE') as anon_pode_executar,
  has_function_privilege('service_role', 'public.ensure_user_workspace()', 'EXECUTE') as service_role_pode_executar;
