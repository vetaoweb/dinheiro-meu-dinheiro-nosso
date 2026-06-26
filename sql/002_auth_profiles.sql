begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  email text not null,
  whatsapp text,
  avatar_path text,
  status public.profile_status not null default 'active',
  accepted_terms_at timestamptz,
  accepted_privacy_at timestamptz,
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index profiles_email_lower_uidx on public.profiles (lower(email)) where deleted_at is null;

create table public.financial_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  type public.space_type not null,
  currency char(3) not null default 'BRL',
  status public.space_status not null default 'active',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.space_members (
  id uuid primary key default gen_random_uuid(),
  financial_space_id uuid not null references public.financial_spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'viewer',
  status public.member_status not null default 'active',
  invited_by uuid references public.profiles(id),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (financial_space_id, user_id)
);

create index space_members_user_idx on public.space_members(user_id, status);
create index space_members_space_idx on public.space_members(financial_space_id, status);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_space_id uuid;
  v_name text;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1));

  insert into public.profiles (
    id, full_name, email, whatsapp, accepted_terms_at, accepted_privacy_at
  ) values (
    new.id,
    v_name,
    new.email,
    nullif(trim(new.raw_user_meta_data->>'whatsapp'), ''),
    now(),
    now()
  );

  insert into public.financial_spaces (name, type, created_by)
  values ('Meu dinheiro', 'personal', new.id)
  returning id into v_space_id;

  insert into public.space_members (financial_space_id, user_id, role, status, joined_at)
  values (v_space_id, new.id, 'owner', 'active', now());

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger spaces_set_updated_at before update on public.financial_spaces for each row execute function public.set_updated_at();
create trigger space_members_set_updated_at before update on public.space_members for each row execute function public.set_updated_at();

commit;
