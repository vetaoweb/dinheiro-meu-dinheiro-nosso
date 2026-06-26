begin;

alter table public.profiles enable row level security;
alter table public.financial_spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.goals enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid() and deleted_at is null)
with check (id = auth.uid());

create policy spaces_select_member
on public.financial_spaces for select
to authenticated
using (public.is_space_member(id));

create policy spaces_update_manager
on public.financial_spaces for update
to authenticated
using (public.can_manage_space(id))
with check (public.can_manage_space(id));

create policy members_select_space
on public.space_members for select
to authenticated
using (public.is_space_member(financial_space_id));

create policy members_insert_manager
on public.space_members for insert
to authenticated
with check (public.can_manage_space(financial_space_id));

create policy members_update_manager
on public.space_members for update
to authenticated
using (public.can_manage_space(financial_space_id))
with check (public.can_manage_space(financial_space_id));

create policy members_delete_manager
on public.space_members for delete
to authenticated
using (public.can_manage_space(financial_space_id));

create policy accounts_select_member
on public.accounts for select
to authenticated
using (public.is_space_member(financial_space_id));

create policy accounts_insert_editor
on public.accounts for insert
to authenticated
with check (public.can_edit_space(financial_space_id) and created_by = auth.uid());

create policy accounts_update_editor
on public.accounts for update
to authenticated
using (public.can_edit_space(financial_space_id))
with check (public.can_edit_space(financial_space_id));

create policy categories_select_member
on public.categories for select
to authenticated
using (public.is_space_member(financial_space_id));

create policy categories_insert_editor
on public.categories for insert
to authenticated
with check (public.can_edit_space(financial_space_id) and created_by = auth.uid());

create policy categories_update_editor
on public.categories for update
to authenticated
using (public.can_edit_space(financial_space_id))
with check (public.can_edit_space(financial_space_id));

create policy transactions_select_member
on public.transactions for select
to authenticated
using (public.is_space_member(financial_space_id));

create policy transactions_insert_editor
on public.transactions for insert
to authenticated
with check (public.can_edit_space(financial_space_id) and created_by = auth.uid());

create policy transactions_update_editor
on public.transactions for update
to authenticated
using (public.can_edit_space(financial_space_id))
with check (public.can_edit_space(financial_space_id));

create policy recurring_select_member
on public.recurring_transactions for select
to authenticated
using (public.is_space_member(financial_space_id));

create policy recurring_insert_editor
on public.recurring_transactions for insert
to authenticated
with check (public.can_edit_space(financial_space_id) and created_by = auth.uid());

create policy recurring_update_editor
on public.recurring_transactions for update
to authenticated
using (public.can_edit_space(financial_space_id))
with check (public.can_edit_space(financial_space_id));

create policy goals_select_member
on public.goals for select
to authenticated
using (public.is_space_member(financial_space_id));

create policy goals_insert_editor
on public.goals for insert
to authenticated
with check (public.can_edit_space(financial_space_id) and created_by = auth.uid());

create policy goals_update_editor
on public.goals for update
to authenticated
using (public.can_edit_space(financial_space_id))
with check (public.can_edit_space(financial_space_id));

create policy privacy_select_own
on public.privacy_requests for select
to authenticated
using (user_id = auth.uid());

create policy privacy_insert_own
on public.privacy_requests for insert
to authenticated
with check (user_id = auth.uid());

create policy audit_select_manager
on public.audit_logs for select
to authenticated
using (public.can_manage_space(financial_space_id));

revoke all on table
  public.profiles,
  public.financial_spaces,
  public.space_members,
  public.accounts,
  public.categories,
  public.transactions,
  public.recurring_transactions,
  public.goals,
  public.privacy_requests,
  public.audit_logs
from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, whatsapp, avatar_path, last_access_at, updated_at) on public.profiles to authenticated;
grant select, update on public.financial_spaces to authenticated;
grant select, insert, update, delete on public.space_members to authenticated;
grant select, insert, update on public.accounts to authenticated;
grant select, insert, update on public.categories to authenticated;
grant select, insert, update on public.transactions to authenticated;
grant select, insert, update on public.recurring_transactions to authenticated;
grant select, insert, update on public.goals to authenticated;
grant select, insert on public.privacy_requests to authenticated;
grant select on public.audit_logs to authenticated;

revoke all on function public.is_space_member(uuid) from public;
revoke all on function public.can_edit_space(uuid) from public;
revoke all on function public.can_manage_space(uuid) from public;
revoke all on function public.get_12_month_projection(uuid, date) from public;

grant execute on function public.is_space_member(uuid) to authenticated;
grant execute on function public.can_edit_space(uuid) to authenticated;
grant execute on function public.can_manage_space(uuid) to authenticated;
grant execute on function public.get_12_month_projection(uuid, date) to authenticated;

commit;
