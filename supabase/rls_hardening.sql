-- Apply only after reviewing the current policies in a local/test/staging project.
-- This migration intentionally does not delete or transform application data.

begin;

alter table public.profiles enable row level security;
alter table public.residents enable row level security;
alter table public.reports enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

drop policy if exists "Profiles are readable by signed in users" on public.profiles;
drop policy if exists "Users can insert own resident profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists profiles_insert_policy on public.profiles;
drop policy if exists profiles_select_policy on public.profiles;
drop policy if exists profiles_update_policy on public.profiles;

create policy profiles_select_self_or_office
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_staff_or_admin());

create policy profiles_insert_own_resident
  on public.profiles
  for insert
  to authenticated
  with check (
    id = auth.uid()
    and lower(trim(coalesce(role, 'resident'))) = 'resident'
  );

create policy profiles_insert_admin
  on public.profiles
  for insert
  to authenticated
  with check (public.is_admin());

create policy profiles_update_own_resident
  on public.profiles
  for update
  to authenticated
  using (
    id = auth.uid()
    and lower(trim(coalesce(role, 'resident'))) = 'resident'
  )
  with check (
    id = auth.uid()
    and lower(trim(coalesce(role, 'resident'))) = 'resident'
  );

create policy profiles_update_admin
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.prevent_profile_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.id = auth.uid() and not public.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Users cannot change their own profile role or status';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_self_escalation on public.profiles;
create trigger prevent_profile_self_escalation
before update on public.profiles
for each row
execute function public.prevent_profile_self_escalation();

drop policy if exists "Residents are readable by signed in users" on public.residents;
drop policy if exists "Residents can insert own row" on public.residents;
drop policy if exists "Residents can update own row" on public.residents;
drop policy if exists residents_insert_policy on public.residents;
drop policy if exists residents_select_policy on public.residents;
drop policy if exists residents_update_policy on public.residents;

create policy residents_select_own_or_office
  on public.residents
  for select
  to authenticated
  using (
    id = auth.uid()
    or user_id = auth.uid()
    or public.is_staff_or_admin()
  );

create policy residents_insert_own_or_office
  on public.residents
  for insert
  to authenticated
  with check (
    id = auth.uid()
    or user_id = auth.uid()
    or public.is_staff_or_admin()
  );

create policy residents_update_own_or_office
  on public.residents
  for update
  to authenticated
  using (
    id = auth.uid()
    or user_id = auth.uid()
    or public.is_staff_or_admin()
  )
  with check (
    id = auth.uid()
    or user_id = auth.uid()
    or public.is_staff_or_admin()
  );

create or replace function public.prevent_resident_protected_updates()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.user_id = auth.uid() and not public.is_staff_or_admin() then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.status is distinct from old.status
      or new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'Residents cannot change protected verification fields';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_resident_protected_updates on public.residents;
create trigger prevent_resident_protected_updates
before update on public.residents
for each row
execute function public.prevent_resident_protected_updates();

drop policy if exists "Reports are readable by signed in users" on public.reports;
drop policy if exists "Residents can delete own reports" on public.reports;
drop policy if exists "Residents can insert own reports" on public.reports;
drop policy if exists "Residents can update own reports" on public.reports;
drop policy if exists reports_delete_policy on public.reports;
drop policy if exists reports_insert_policy on public.reports;
drop policy if exists reports_select_policy on public.reports;
drop policy if exists reports_update_policy on public.reports;

create policy reports_select_own_or_office
  on public.reports
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_staff_or_admin());

create policy reports_insert_own
  on public.reports
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy reports_update_own_or_office
  on public.reports
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_staff_or_admin())
  with check (user_id = auth.uid() or public.is_staff_or_admin());

create policy reports_delete_own_or_admin
  on public.reports
  for delete
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create or replace function public.prevent_report_protected_updates()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.user_id = auth.uid() and not public.is_staff_or_admin() then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.status is distinct from old.status
      or new.admin_note is distinct from old.admin_note then
      raise exception 'Residents cannot change report workflow fields';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_report_protected_updates on public.reports;
create trigger prevent_report_protected_updates
before update on public.reports
for each row
execute function public.prevent_report_protected_updates();

drop policy if exists "Published announcements are readable" on public.announcements;
drop policy if exists "Signed in users can manage announcements" on public.announcements;
drop policy if exists announcements_delete_policy on public.announcements;
drop policy if exists announcements_insert_policy on public.announcements;
drop policy if exists announcements_select_policy on public.announcements;
drop policy if exists announcements_update_policy on public.announcements;

create policy announcements_select_published_or_office
  on public.announcements
  for select
  to authenticated
  using (is_published = true or public.is_staff_or_admin());

create policy announcements_insert_office
  on public.announcements
  for insert
  to authenticated
  with check (
    public.is_staff_or_admin()
    and (created_by is null or created_by = auth.uid())
  );

create policy announcements_update_office
  on public.announcements
  for update
  to authenticated
  using (public.is_staff_or_admin())
  with check (public.is_staff_or_admin());

create policy announcements_delete_office
  on public.announcements
  for delete
  to authenticated
  using (public.is_staff_or_admin());

drop policy if exists "Users can insert own announcement reads" on public.announcement_reads;
drop policy if exists "Users can read own announcement reads" on public.announcement_reads;
drop policy if exists "Users can update own announcement reads" on public.announcement_reads;
drop policy if exists announcement_reads_insert_policy on public.announcement_reads;
drop policy if exists announcement_reads_select_policy on public.announcement_reads;
drop policy if exists announcement_reads_update_policy on public.announcement_reads;

create policy announcement_reads_select_own
  on public.announcement_reads
  for select
  to authenticated
  using (user_id = auth.uid());

create policy announcement_reads_insert_own
  on public.announcement_reads
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy announcement_reads_update_own
  on public.announcement_reads
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
