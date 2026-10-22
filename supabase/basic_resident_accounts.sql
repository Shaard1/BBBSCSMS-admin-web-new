-- Stage after security_followup.sql. Apply to TEST first. No existing approvals changed.
begin;

create table if not exists public.resident_access_settings (
  singleton boolean primary key default true check (singleton),
  environment text not null default 'production' check (environment in ('test','production')),
  allow_unverified_test_access boolean not null default false,
  check (not allow_unverified_test_access or environment = 'test')
);
insert into public.resident_access_settings(singleton) values (true) on conflict do nothing;
alter table public.resident_access_settings enable row level security;
revoke all on public.resident_access_settings from public, anon, authenticated;
grant select, insert, update, delete on public.resident_access_settings to service_role;

-- Snapshot once: a newly-created user cannot claim legacy access by skipping provisioning.
create table if not exists public.legacy_resident_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.legacy_resident_accounts enable row level security;
revoke all on public.legacy_resident_accounts from public, anon, authenticated;
grant select on public.legacy_resident_accounts to service_role;
do $$
begin
  if to_regclass('public.resident_accounts') is null then
    insert into public.legacy_resident_accounts(user_id)
      select u.id from auth.users u where exists (
        select 1 from public.profiles p where p.id = u.id and p.role = 'resident'
      ) or exists (
        select 1 from public.residents r where coalesce(r.user_id,r.id) = u.id
      ) on conflict do nothing;
  end if;
end;
$$;

create table if not exists public.resident_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_state text not null default 'active' check (account_state in ('active','suspended')),
  identity_status text not null default 'unverified' check (identity_status in ('unverified','verified','rejected')),
  declared_phone text not null check (declared_phone ~ '^\+639[0-9]{9}$'),
  privacy_version text not null,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.resident_accounts enable row level security;
revoke all on public.resident_accounts from public, anon, authenticated;
grant select on public.resident_accounts to authenticated;
grant select, insert, update, delete on public.resident_accounts to service_role;
drop policy if exists resident_accounts_read on public.resident_accounts;
create policy resident_accounts_read on public.resident_accounts for select to authenticated
  using (user_id = auth.uid() or public.is_staff_or_admin());

-- Derive phone verification from Auth, never from editable user metadata or ID approval.
create or replace function public.resident_basic_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.legacy_resident_accounts where user_id = auth.uid())
    or exists (
      select 1 from public.resident_accounts a join auth.users u on u.id = a.user_id
      join public.profiles p on p.id = a.user_id
      where a.user_id = auth.uid() and a.account_state = 'active'
        and p.role = 'resident' and p.status <> 'rejected'
        and ((u.phone_confirmed_at is not null and ltrim(u.phone, '+') = ltrim(a.declared_phone, '+'))
          or exists (select 1 from public.resident_access_settings
            where singleton and environment = 'test' and allow_unverified_test_access))
    )
  );
$$;

create or replace function public.get_my_resident_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'account_state', a.account_state,
    'identity_status', a.identity_status,
    'phone_verified', u.phone_confirmed_at is not null and ltrim(u.phone, '+') = ltrim(a.declared_phone, '+'),
    'basic_access', public.resident_basic_access(),
    'test_access', exists (select 1 from public.resident_access_settings
      where singleton and environment = 'test' and allow_unverified_test_access)
  ) from public.resident_accounts a join auth.users u on u.id = a.user_id
  where a.user_id = auth.uid();
$$;

create or replace function public.basic_registration_preview_available()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.resident_access_settings
    where singleton and environment = 'test' and allow_unverified_test_access);
$$;
revoke all on function public.basic_registration_preview_available() from public;
grant execute on function public.basic_registration_preview_available() to anon, authenticated, service_role;

create or replace function public.get_office_resident_accounts()
returns table(user_id uuid, account_state text, identity_status text, phone_verified boolean)
language sql stable security definer set search_path = '' as $$
  select a.user_id, a.account_state, a.identity_status,
    coalesce(u.phone_confirmed_at is not null and ltrim(u.phone, '+') = ltrim(a.declared_phone, '+'), false)
  from public.resident_accounts a join auth.users u on u.id = a.user_id
  where public.is_staff_or_admin();
$$;
revoke all on function public.get_office_resident_accounts() from public, anon;
grant execute on function public.get_office_resident_accounts() to authenticated, service_role;

create or replace function public.prevent_basic_account_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status and exists (
    select 1 from public.resident_accounts where user_id = old.id
  ) then
    raise exception 'Basic accounts do not use legacy approval. Use account suspension or service-specific identity checks.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_basic_account_approval() from public, anon, authenticated;
drop trigger if exists prevent_basic_account_approval on public.residents;
create trigger prevent_basic_account_approval before update on public.residents
  for each row execute function public.prevent_basic_account_approval();

create or replace function public.complete_basic_registration(
  p_full_name text, p_phone text, p_privacy_version text, p_terms_version text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  auth_email text;
  resident_profile_role text;
begin
  if caller is null then raise exception 'Sign in before completing registration' using errcode = '42501'; end if;
  if length(btrim(p_full_name)) not between 2 and 150 or p_full_name is null
    or p_phone is null or p_phone !~ '^\+639[0-9]{9}$'
    or p_privacy_version is distinct from '2026-10-21'
    or p_terms_version is distinct from '2026-10-21' then
    raise exception 'Invalid account details or notice versions' using errcode = '22023';
  end if;
  select role into resident_profile_role from public.profiles where id = caller;
  if resident_profile_role is not null and resident_profile_role <> 'resident' then
    raise exception 'Office accounts cannot become resident accounts' using errcode = '42501';
  end if;
  -- Do not silently convert legacy resident accounts or reuse their historical approvals.
  if exists (select 1 from public.residents where coalesce(user_id,id) = caller)
     and not exists (select 1 from public.resident_accounts where user_id = caller) then
    raise exception 'Existing resident accounts require a separate migration' using errcode = '42501';
  end if;
  select email into auth_email from auth.users where id = caller;
  insert into public.profiles(id,full_name,email,role,status)
    values(caller,btrim(p_full_name),auth_email,'resident','pending') on conflict (id) do nothing;
  insert into public.residents(id,user_id,full_name,email,contact_number,status)
    values(caller,caller,btrim(p_full_name),auth_email,p_phone,'pending') on conflict (id) do nothing;
  insert into public.resident_accounts(user_id,declared_phone,privacy_version,terms_version)
    values(caller,p_phone,p_privacy_version,p_terms_version) on conflict (user_id) do nothing;
  return public.get_my_resident_access();
end;
$$;

revoke all on function public.resident_basic_access(), public.get_my_resident_access(),
  public.complete_basic_registration(text,text,text,text) from public, anon;
grant execute on function public.resident_basic_access(), public.get_my_resident_access(),
  public.complete_basic_registration(text,text,text,text) to authenticated, service_role;

-- Additional restrictions intersect existing owner/office policies; they do not grant access.
do $$
declare tbl text;
begin
  foreach tbl in array array['profiles','residents','reports','announcements','announcement_reads','document_requests'] loop
    execute format('drop policy if exists basic_account_access on public.%I', tbl);
    execute format('create policy basic_account_access on public.%I as restrictive for all to authenticated using (public.is_staff_or_admin() or public.resident_basic_access()) with check (public.is_staff_or_admin() or public.resident_basic_access())', tbl);
  end loop;
end;
$$;
drop policy if exists basic_account_storage_access on storage.objects;
create policy basic_account_storage_access on storage.objects as restrictive for all to authenticated
  using (bucket_id not in ('resident-files','report-images') or public.is_staff_or_admin() or public.resident_basic_access())
  with check (bucket_id not in ('resident-files','report-images') or public.is_staff_or_admin() or public.resident_basic_access());

-- Phone verification, identity verification and legacy resident approval remain independent.
-- Even an office approval cannot activate an unverified phone account through this RPC.
notify pgrst, 'reload schema';
commit;

