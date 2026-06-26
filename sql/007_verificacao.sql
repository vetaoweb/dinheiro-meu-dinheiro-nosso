-- SOMENTE LEITURA: execute após as migrations.

select
  c.relname as tabela,
  c.relrowsecurity as rls_ativo,
  count(p.policyname) as quantidade_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p
  on p.schemaname = n.nspname and p.tablename = c.relname
where n.nspname = 'public'
  and c.relname in (
    'profiles','financial_spaces','space_members','accounts','categories',
    'transactions','recurring_transactions','goals','privacy_requests','audit_logs'
  )
group by c.relname, c.relrowsecurity
order by c.relname;

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'is_space_member','can_edit_space','can_manage_space',
    'get_12_month_projection','create_financial_space','handle_new_user'
  )
order by routine_name;

select
  trigger_name,
  event_object_schema,
  event_object_table,
  action_timing,
  event_manipulation
from information_schema.triggers
where event_object_schema in ('public','auth')
order by event_object_schema, event_object_table, trigger_name;

select
  'tabelas' as item,
  count(*) as total
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles','financial_spaces','space_members','accounts','categories',
    'transactions','recurring_transactions','goals','privacy_requests','audit_logs'
  )
union all
select
  'policies',
  count(*)
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles','financial_spaces','space_members','accounts','categories',
    'transactions','recurring_transactions','goals','privacy_requests','audit_logs'
  );
