begin;

create type public.invitation_status as enum ('pending', 'accepted', 'cancelled', 'expired');

create table public.space_invitations (
  id uuid primary key default gen_random_uuid(),
  financial_space_id uuid not null references public.financial_spaces(id) on delete cascade,
  email text not null check (char_length(trim(email)) between 5 and 254),
  role public.member_role not null default 'editor' check (role in ('admin','editor','viewer')),
  token uuid not null unique default gen_random_uuid(),
  status public.invitation_status not null default 'pending',
  invited_by uuid not null default auth.uid() references public.profiles(id),
  accepted_by uuid references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index space_invitations_pending_email_uidx
  on public.space_invitations (financial_space_id, lower(email))
  where status = 'pending';

create index space_invitations_email_status_idx
  on public.space_invitations (lower(email), status, expires_at);

create trigger space_invitations_set_updated_at
  before update on public.space_invitations
  for each row execute function public.set_updated_at();

create trigger audit_space_invitations
  after insert or update or delete on public.space_invitations
  for each row execute function public.audit_row_change();

alter table public.space_invitations enable row level security;

revoke all on table public.space_invitations from anon, authenticated;

create or replace function public.create_space_invitation(
  p_space_id uuid,
  p_email text,
  p_role public.member_role default 'editor'
)
returns table (
  invitation_id uuid,
  invitation_token uuid,
  invitation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
  space_kind public.space_type;
  created_invitation public.space_invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  if not public.can_manage_space(p_space_id) then
    raise exception 'Somente proprietários e administradores podem convidar pessoas.' using errcode = '42501';
  end if;

  if p_role not in ('admin','editor','viewer') then
    raise exception 'Papel inválido para o convite.';
  end if;

  if normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Informe um e-mail válido.';
  end if;

  select fs.type
    into space_kind
    from public.financial_spaces fs
   where fs.id = p_space_id
     and fs.status = 'active'
     and fs.deleted_at is null;

  if not found then
    raise exception 'Espaço financeiro não encontrado.';
  end if;

  if space_kind = 'personal' then
    raise exception 'O espaço pessoal não pode receber outros integrantes.';
  end if;

  if exists (
    select 1
      from public.profiles p
      join public.space_members sm on sm.user_id = p.id
     where sm.financial_space_id = p_space_id
       and sm.status = 'active'
       and lower(p.email) = normalized_email
  ) then
    raise exception 'Essa pessoa já participa do espaço.';
  end if;

  update public.space_invitations
     set status = 'cancelled',
         cancelled_at = now()
   where financial_space_id = p_space_id
     and lower(email) = normalized_email
     and status = 'pending';

  insert into public.space_invitations (
    financial_space_id,
    email,
    role,
    invited_by
  ) values (
    p_space_id,
    normalized_email,
    p_role,
    auth.uid()
  )
  returning * into created_invitation;

  return query select
    created_invitation.id,
    created_invitation.token,
    created_invitation.expires_at;
end;
$$;

create or replace function public.get_invitation_preview(p_token uuid)
returns table (
  space_name text,
  space_type public.space_type,
  invited_role public.member_role,
  masked_email text,
  invitation_status text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fs.name,
    fs.type,
    si.role,
    left(split_part(si.email, '@', 1), 1)
      || repeat('*', greatest(length(split_part(si.email, '@', 1)) - 1, 3))
      || '@' || split_part(si.email, '@', 2),
    case
      when si.status = 'pending' and si.expires_at <= now() then 'expired'
      else si.status::text
    end,
    si.expires_at
  from public.space_invitations si
  join public.financial_spaces fs on fs.id = si.financial_space_id
  where si.token = p_token
    and fs.deleted_at is null;
$$;

create or replace function public.accept_space_invitation(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  invitation public.space_invitations%rowtype;
begin
  if current_user_id is null then
    raise exception 'Entre na sua conta para aceitar o convite.' using errcode = '42501';
  end if;

  select lower(p.email)
    into current_email
    from public.profiles p
   where p.id = current_user_id
     and p.status = 'active'
     and p.deleted_at is null;

  if current_email is null then
    raise exception 'Perfil ativo não encontrado.';
  end if;

  select *
    into invitation
    from public.space_invitations si
   where si.token = p_token
   for update;

  if not found then
    raise exception 'Convite não encontrado.';
  end if;

  if invitation.status <> 'pending' then
    raise exception 'Este convite não está mais disponível.';
  end if;

  if invitation.expires_at <= now() then
    update public.space_invitations
       set status = 'expired'
     where id = invitation.id;
    raise exception 'Este convite expirou.';
  end if;

  if lower(invitation.email) <> current_email then
    raise exception 'Este convite foi enviado para outro endereço de e-mail.' using errcode = '42501';
  end if;

  insert into public.space_members (
    financial_space_id,
    user_id,
    role,
    status,
    invited_by,
    joined_at
  ) values (
    invitation.financial_space_id,
    current_user_id,
    invitation.role,
    'active',
    invitation.invited_by,
    now()
  )
  on conflict (financial_space_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    invited_by = excluded.invited_by,
    joined_at = now();

  update public.space_invitations
     set status = 'accepted',
         accepted_by = current_user_id,
         accepted_at = now()
   where id = invitation.id;

  return invitation.financial_space_id;
end;
$$;

create or replace function public.cancel_space_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  space_id uuid;
begin
  select si.financial_space_id
    into space_id
    from public.space_invitations si
   where si.id = p_invitation_id
     and si.status = 'pending';

  if space_id is null or not public.can_manage_space(space_id) then
    raise exception 'Convite não encontrado ou acesso negado.' using errcode = '42501';
  end if;

  update public.space_invitations
     set status = 'cancelled',
         cancelled_at = now()
   where id = p_invitation_id;
end;
$$;

create or replace function public.get_space_members(p_space_id uuid)
returns table (
  user_id uuid,
  full_name text,
  email text,
  member_role public.member_role,
  member_status public.member_status,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_space_member(p_space_id) then
    raise exception 'Acesso negado ao espaço financeiro.' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.email,
    sm.role,
    sm.status,
    sm.joined_at
  from public.space_members sm
  join public.profiles p on p.id = sm.user_id
  where sm.financial_space_id = p_space_id
    and sm.status <> 'removed'
  order by
    case sm.role when 'owner' then 1 when 'admin' then 2 when 'editor' then 3 else 4 end,
    p.full_name;
end;
$$;

create or replace function public.get_space_invitations(p_space_id uuid)
returns table (
  invitation_id uuid,
  email text,
  invited_role public.member_role,
  invitation_status public.invitation_status,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_manage_space(p_space_id) then
    raise exception 'Acesso negado aos convites deste espaço.' using errcode = '42501';
  end if;

  return query
  select
    si.id,
    si.email,
    si.role,
    case
      when si.status = 'pending' and si.expires_at <= now() then 'expired'::public.invitation_status
      else si.status
    end,
    si.expires_at,
    si.created_at
  from public.space_invitations si
  where si.financial_space_id = p_space_id
  order by si.created_at desc;
end;
$$;

create or replace function public.get_my_pending_invitations()
returns table (
  invitation_token uuid,
  financial_space_id uuid,
  space_name text,
  space_type public.space_type,
  invited_role public.member_role,
  expires_at timestamptz,
  invited_by_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_email text;
begin
  select lower(p.email)
    into current_email
    from public.profiles p
   where p.id = auth.uid();

  if current_email is null then
    return;
  end if;

  return query
  select
    si.token,
    fs.id,
    fs.name,
    fs.type,
    si.role,
    si.expires_at,
    inviter.full_name
  from public.space_invitations si
  join public.financial_spaces fs on fs.id = si.financial_space_id
  join public.profiles inviter on inviter.id = si.invited_by
  where lower(si.email) = current_email
    and si.status = 'pending'
    and si.expires_at > now()
    and fs.status = 'active'
    and fs.deleted_at is null
  order by si.created_at desc;
end;
$$;

revoke all on function public.create_space_invitation(uuid, text, public.member_role) from public;
revoke all on function public.get_invitation_preview(uuid) from public;
revoke all on function public.accept_space_invitation(uuid) from public;
revoke all on function public.cancel_space_invitation(uuid) from public;
revoke all on function public.get_space_members(uuid) from public;
revoke all on function public.get_space_invitations(uuid) from public;
revoke all on function public.get_my_pending_invitations() from public;

grant execute on function public.get_invitation_preview(uuid) to anon, authenticated;
grant execute on function public.create_space_invitation(uuid, text, public.member_role) to authenticated;
grant execute on function public.accept_space_invitation(uuid) to authenticated;
grant execute on function public.cancel_space_invitation(uuid) to authenticated;
grant execute on function public.get_space_members(uuid) to authenticated;
grant execute on function public.get_space_invitations(uuid) to authenticated;
grant execute on function public.get_my_pending_invitations() to authenticated;

commit;
