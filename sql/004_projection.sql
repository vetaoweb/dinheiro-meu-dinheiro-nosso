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
  v_current_month date := date_trunc('month', current_date)::date;
  v_requested_month date;
  v_horizon_exclusive date;
  v_opening_balance numeric(14,2);
begin
  if not public.is_space_member(p_space_id) then
    raise exception 'Acesso negado ao espaço financeiro.' using errcode = '42501';
  end if;

  v_requested_month := greatest(
    coalesce(date_trunc('month', p_start_month)::date, v_current_month),
    v_current_month
  );
  v_horizon_exclusive := (v_requested_month + interval '12 months')::date;

  select coalesce(sum(a.current_balance), 0)::numeric(14,2)
    into v_opening_balance
    from public.accounts a
   where a.financial_space_id = p_space_id
     and a.status = 'active'
     and a.deleted_at is null
     and a.include_in_projection = true;

  return query
  with recursive
  months as (
    select generate_series(
      v_current_month::timestamp,
      (v_horizon_exclusive - interval '1 month')::timestamp,
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
      and greatest(t.effective_date, current_date) < v_horizon_exclusive
    group by 1, 2
  ),
  recurring_occurrences as (
    select
      r.id as recurring_id,
      r.type,
      r.amount,
      occurrence_at::date as occurrence_date
    from public.recurring_transactions r
    cross join lateral generate_series(
      r.start_date::timestamp,
      least(coalesce(r.end_date, v_horizon_exclusive - 1), v_horizon_exclusive - 1)::timestamp,
      case r.frequency
        when 'weekly' then make_interval(days => 7 * r.interval_count)
        when 'monthly' then make_interval(months => r.interval_count)
        when 'yearly' then make_interval(years => r.interval_count)
      end
    ) as occurrence_at
    where r.financial_space_id = p_space_id
      and r.status = 'active'
      and r.deleted_at is null
      and occurrence_at::date >= current_date
      and occurrence_at::date < v_horizon_exclusive
      and not exists (
        select 1
          from public.transactions actual
         where actual.recurring_transaction_id = r.id
           and actual.effective_date = occurrence_at::date
           and actual.deleted_at is null
           and actual.status <> 'cancelled'
      )
  ),
  recurring_monthly as (
    select
      date_trunc('month', occurrence_date)::date as month_start,
      type,
      sum(amount)::numeric(14,2) as amount
    from recurring_occurrences
    group by 1, 2
  ),
  combined as (
    select * from one_time
    union all
    select * from recurring_monthly
  ),
  monthly_flows as (
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
  numbered as (
    select
      row_number() over (order by mf.month_start) as rn,
      mf.*,
      (mf.income - mf.expense - mf.savings)::numeric(14,2) as net_cash_flow
    from monthly_flows mf
  ),
  balances as (
    select
      n.rn,
      n.month_start,
      v_opening_balance::numeric(14,2) as opening_balance,
      n.income,
      n.expense,
      n.savings,
      0::numeric(14,2) as transfers_in,
      n.transfers_out,
      n.net_cash_flow,
      (v_opening_balance + n.net_cash_flow)::numeric(14,2) as closing_balance
    from numbered n
    where n.rn = 1

    union all

    select
      n.rn,
      n.month_start,
      b.closing_balance as opening_balance,
      n.income,
      n.expense,
      n.savings,
      0::numeric(14,2) as transfers_in,
      n.transfers_out,
      n.net_cash_flow,
      (b.closing_balance + n.net_cash_flow)::numeric(14,2) as closing_balance
    from numbered n
    join balances b on n.rn = b.rn + 1
  )
  select
    b.month_start,
    b.opening_balance,
    b.income,
    b.expense,
    b.savings,
    b.transfers_in,
    b.transfers_out,
    b.net_cash_flow,
    b.closing_balance
  from balances b
  where b.month_start >= v_requested_month
  order by b.month_start
  limit 12;
end;
$$;

commit;
