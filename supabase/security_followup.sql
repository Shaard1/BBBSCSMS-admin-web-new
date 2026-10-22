-- Coordinated security follow-up to the 2026-10-20 inspection.
-- Apply to a restored staging database FIRST, after deploying signed-file readers
-- in BOTH clients. This does not delete records, objects, or legacy payment fields.
-- Existing mobile installations using public image URLs will need an update.
-- Run database_security_checks.sql before/after and the rollout checks in docs.
begin;

-- Abort rather than silently apply against an unexpected schema or linkage.
do $$
begin
  if to_regclass('public.document_requests') is null
     or to_regclass('public.residents') is null
     or to_regclass('storage.objects') is null then
    raise exception 'Expected application/storage schema is missing';
  end if;
  if exists (
    select 1 from public.residents r
    join public.residents other on other.id = r.user_id
    where r.user_id is not null and r.id <> r.user_id
      and coalesce(other.user_id, other.id) <> r.user_id
  ) then
    raise exception 'Ambiguous resident ownership requires manual reconciliation first';
  end if;
end;
$$;

-- Ordinary clients need DML governed by RLS, not TRUNCATE or trigger creation.
revoke truncate, trigger on table
  public.profiles, public.residents, public.reports, public.announcements,
  public.announcement_reads, public.document_requests
from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate, trigger on tables from public, anon, authenticated;
-- Schema-specific REVOKE alone cannot cancel globally granted defaults.
alter default privileges for role postgres
  revoke truncate, trigger on tables from public, anon, authenticated;
do $$
begin
  if to_regclass('public.rls_policies_backup_2026_05_21') is not null then
    execute 'revoke all on table public.rls_policies_backup_2026_05_21 from public, anon, authenticated';
  end if;
end;
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'approved');
$$;
create or replace function public.is_staff_or_admin()
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (select 1 from public.profiles
    where id = auth.uid() and role in ('staff', 'admin') and status = 'approved');
$$;
revoke all on function public.is_admin(), public.is_staff_or_admin() from public, anon;
grant execute on function public.is_admin(), public.is_staff_or_admin() to authenticated, service_role;

-- Link ownership through user_id when present; id is the legacy fallback only.
drop policy if exists residents_select_own_or_office on public.residents;
drop policy if exists residents_insert_own_or_office on public.residents;
drop policy if exists residents_update_own_or_office on public.residents;
create policy residents_select_own_or_office on public.residents for select to authenticated
  using (coalesce(user_id, id) = auth.uid() or public.is_staff_or_admin());
create policy residents_insert_own_or_office on public.residents for insert to authenticated
  with check ((id = auth.uid() and user_id = auth.uid()) or public.is_staff_or_admin());
create policy residents_update_own_or_office on public.residents for update to authenticated
  using (coalesce(user_id, id) = auth.uid() or public.is_staff_or_admin())
  with check (coalesce(user_id, id) = auth.uid() or public.is_staff_or_admin());

create or replace function public.prevent_resident_protected_updates()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is not null and auth.role() <> 'service_role'
     and not public.is_staff_or_admin() then
    if new.id is distinct from old.id or new.user_id is distinct from old.user_id
       or new.status is distinct from old.status
       or new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'Residents cannot change protected verification fields' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Creation controls supplement the existing UPDATE guards. Do not trust defaults:
-- clients can explicitly send a status, note, price, or verification decision.
create or replace function public.guard_resident_client_inserts()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  -- Trusted maintenance and server provisioning retain their existing behavior.
  if auth.uid() is null or auth.role() = 'service_role' then return new; end if;
  if public.is_staff_or_admin() then return new; end if;
  if tg_table_name = 'profiles' then
    if new.id <> auth.uid() or new.role <> 'resident' or new.status <> 'pending' then
      raise exception 'New resident profiles must be pending and self-owned' using errcode = '42501';
    end if;
  elsif tg_table_name = 'residents' then
    if new.id <> auth.uid() or new.user_id is distinct from auth.uid()
       or new.status <> 'pending' or new.rejection_reason is not null then
      raise exception 'New resident records must be pending and self-owned' using errcode = '42501';
    end if;
  elsif tg_table_name = 'reports' then
    if new.user_id <> auth.uid() or new.status <> 'pending'
       or nullif(btrim(new.admin_note), '') is not null then
      raise exception 'New reports must be pending without staff notes' using errcode = '42501';
    end if;
  elsif tg_table_name = 'document_requests' then
    -- awaiting_payment retained only for old clients until payment UI removal.
    if new.user_id is distinct from auth.uid()
       or new.status not in ('pending', 'awaiting_payment')
       or new.rejection_reason is not null then
      raise exception 'New document requests cannot set processing decisions' using errcode = '42501';
    end if;
    if new.resident_id is not null and not exists (
      select 1 from public.residents r
      where coalesce(r.user_id, r.id) = auth.uid()
        and (r.id = new.resident_id or new.resident_id = auth.uid())
    ) then
      raise exception 'Document resident link must belong to the requester' using errcode = '42501';
    end if;
    -- The office must establish fees; client catalog amounts are not authoritative.
    new.fee_amount := null;
    new.fee_label := null;
  end if;
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists guard_resident_profile_insert on public.profiles;
create trigger guard_resident_profile_insert before insert on public.profiles
  for each row execute function public.guard_resident_client_inserts();
drop trigger if exists guard_resident_record_insert on public.residents;
create trigger guard_resident_record_insert before insert on public.residents
  for each row execute function public.guard_resident_client_inserts();
drop trigger if exists guard_resident_report_insert on public.reports;
create trigger guard_resident_report_insert before insert on public.reports
  for each row execute function public.guard_resident_client_inserts();
drop trigger if exists guard_resident_document_insert on public.document_requests;
create trigger guard_resident_document_insert before insert on public.document_requests
  for each row execute function public.guard_resident_client_inserts();

-- Office reads/writes must use the same active-role rule as other modules.
drop policy if exists "Office accounts can review all document requests" on public.document_requests;
drop policy if exists "Office accounts can update document requests" on public.document_requests;
create policy "Office accounts can review all document requests" on public.document_requests
  for select to authenticated using (public.is_staff_or_admin());
create policy "Office accounts can update document requests" on public.document_requests
  for update to authenticated using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

-- Keep guards installed explicitly, including the null-user_id legacy case.
drop trigger if exists prevent_resident_protected_updates on public.residents;
create trigger prevent_resident_protected_updates before update on public.residents
  for each row execute function public.prevent_resident_protected_updates();

-- Remove public object listing/reads, not just the bucket public flag.
drop policy if exists bbbc_storage_public_read on storage.objects;
drop policy if exists bbbc_storage_sensitive_read on storage.objects;
drop policy if exists bbbc_storage_announcement_read on storage.objects;
create policy bbbc_storage_announcement_read on storage.objects
  for select to anon, authenticated using (bucket_id = 'announcement-files');
create policy bbbc_storage_sensitive_read on storage.objects
  for select to authenticated using (
    bucket_id in ('resident-files', 'report-images') and (
      public.is_staff_or_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
      or (bucket_id = 'resident-files'
          and (storage.foldername(name))[1] = 'document-payment-proofs'
          and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );

-- Account deactivation must block direct privileged storage writes as well.
-- Existing announcement policies call the updated active-role helper.
-- Owner upload/update policies remain unchanged; do not add deletion privileges.
update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('resident-files', 'report-images');

-- Abort atomically if inherited grants still leave dangerous privileges in place.
do $$
declare table_oid oid; client_role text;
begin
  for table_oid in select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in (
      'profiles','residents','reports','announcements','announcement_reads','document_requests')
  loop
    foreach client_role in array array['anon','authenticated'] loop
      if has_table_privilege(client_role, table_oid, 'TRUNCATE')
         or has_table_privilege(client_role, table_oid, 'TRIGGER') then
        raise exception 'Inherited unsafe privileges remain for %, table %', client_role, table_oid;
      end if;
    end loop;
  end loop;
end;
$$;

commit;
