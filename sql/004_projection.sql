begin;

create or replace function public.is_space_member(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.space_members sm
     where sm.financial_space_id = p_space_id
       and sm.user_id = auth.uid()
       and sm.status = 'active'
  );
$$;

create or replace function public.can_edit_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.space_members sm
     where sm.financial_space_id = p_space_id
       and sm.user_id = auth.uid()
       and sm.status = 'active'
       and sm.role in ('owner','admin','editor')
  );
$$;

create or replace function public.can_manage_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.space_members sm
     where sm.financial_space_id = p_space_id
       and sm.user_id = auth.uid()
       and sm.status = 'active'
       and sm.role in ('owner','admin')
  );
$$;

create or replace function public.get_12_month_projection(
  p_space_id uuid,
  p_start_month date default null
)
returns table (
  month_start date,
  opening_balance numeric(14,2),
  income numeric(14,2),
  expense numeric(14,2),
  savings numeric(14,2),
  transfers_in numeric(14,2),
  transfers_out numeric(14,2),
  net_cash_flow numeric(14,2),
  closing_balance numeric(14,2)
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  current_month date := date_trunc('month', current_date)::date;
  requested_month date;
  horizon_end date;
  account_balance numeric(14,2);
begin
  if not public.is_space_member(p_space_id) then
    raise exception 'Acesso negado ao espaço financeiro.' using errcode = '42501';
  end if;

  requested_month := greatest(
    coalesce(date_trunc('month', p_start_month)::date, current_month),
    current_month
  );
  horizon_end := (requested_month + interval '12 months')::date;

  select coalesce(sum(a.current_balance), 0)::numeric(14,2)
    into account_balance
    from public.accounts a
   where a.financial_space_id = p_space_id
     and a.status = 'active'
     and a.deleted_at is null
     and a.include_in_projection;

  return query
  with months as (
    select generate_series(
      current_month::timestamp,
      (horizon_end - interval '1 month')::timestamp,
      interval '1 month'
    )::date as month_start
  ),
  one_time as (
    select
      date_trunc('month', greatest(t.effective_date, current_date))::date as month_start,
      t.type,
      sum(t.amount)::numeric(14,2) as amount
    from public.transactions t
    where t.financial_space_id = p_space_id
      and t.deleted_at is null
      and t.status in ('planned','confirmed')
      and greatest(t.effective_date, current_date) < horizon_end
    group by 1, 2
  ),
  recurring as (
    select
      date_trunc('month', gs.occurrence_at)::date as month_start,
      r.type,
      sum(r.amount)::numeric(14,2) as amount
    from public.recurring_transactions r
    cross join lateral generate_series(
      r.start_date::timestamp,
      least(coalesce(r.end_date, horizon_end - 1), horizon_end - 1)::timestamp,
      case r.frequency
        when 'weekly' then make_interval(days => 7 * r.interval_count)
        when 'monthly' then make_interval(months => r.interval_count)
        when 'yearly' then make_interval(years => r.interval_count)
      end
    ) as gs(occurrence_at)
    where r.financial_space_id = p_space_id
      and r.status = 'active'
      and r.deleted_at is null
      and gs.occurrence_at::date >= current_date
      and gs.occurrence_at::date < horizon_end
      and not exists (
        select 1
          from public.transactions t
         where t.recurring_transaction_id = r.id
           and t.effective_date = gs.occurrence_at::date
           and t.deleted_at is null
           and t.status <> 'cancelled'
      )
    group by 1, 2
  ),
  combined as (
    select * from one_time
    union all
    select * from recurring
  ),
  flow as (
    select
      m.month_start,
      coalesce(sum(c.amount) filter (where c.type = 'income'), 0)::numeric(14,2) as income,
      coalesce(sum(c.amount) filter (where c.type = 'expense'), 0)::numeric(14,2) as expense,
      coalesce(sum(c.amount) filter (where c.type = 'saving'), 0)::numeric(14,2) as savings,
      coalesce(sum(c.amount) filter (where c.type = 'transfer'), 0)::numeric(14,2) as transfers_out
    from months m
    left join combined c on c.month_start = m.month_start
    group by m.month_start
  ),
  calculated as (
    select
      f.*,
      (f.income - f.expense - f.savings)::numeric(14,2) as net_cash_flow
    from flow f
  ),
  balance as (
    select
      c.*,
      (account_balance + coalesce(sum(c.net_cash_flow) over (
        order by c.month_start rows between unbounded preceding and 1 preceding
      ), 0))::numeric(14,2) as opening_balance,
      (account_balance + sum(c.net_cash_flow) over (
        order by c.month_start rows between unbounded preceding and current row
      ))::numeric(14,2) as closing_balance
    from calculated c
  )
  select
    b.month_start,
    b.opening_balance,
    b.income,
    b.expense,
    b.savings,
    0::numeric(14,2) as transfers_in,
    b.transfers_out,
    b.net_cash_flow,
    b.closing_balance
  from balance b
  where b.month_start >= requested_month
  order by b.month_start
  limit 12;
end;
$$;

commit;
