begin;

create extension if not exists pgcrypto;

create type public.profile_status as enum ('active', 'blocked', 'suspended', 'deleted');
create type public.space_type as enum ('personal', 'household', 'business');
create type public.space_status as enum ('active', 'archived', 'blocked');
create type public.member_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.member_status as enum ('invited', 'active', 'suspended', 'removed');
create type public.account_type as enum ('checking', 'savings', 'cash', 'investment', 'credit_card', 'other');
create type public.transaction_type as enum ('income', 'expense', 'saving', 'transfer');
create type public.transaction_status as enum ('planned', 'confirmed', 'paid', 'cancelled');
create type public.category_type as enum ('income', 'expense', 'saving', 'both');
create type public.recurrence_frequency as enum ('weekly', 'monthly', 'yearly');
create type public.goal_status as enum ('active', 'paused', 'completed', 'cancelled');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

commit;
