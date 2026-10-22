-- Read-only acceptance report. Run after security_followup.sql in staging.
-- All rows should report passed=true. This does not replace role/ownership tests.
begin transaction read only;
with application_tables as (
  select c.oid, c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname in (
    'profiles','residents','reports','announcements','announcement_reads','document_requests')
), checks as (
  select 'RLS enabled on all six application tables' as check_name,
    count(*) = 6 and bool_and(relrowsecurity) as passed from application_tables
  union all
  select 'No TRUNCATE/TRIGGER privileges for ordinary clients', not exists (
    select 1 from application_tables t cross join pg_roles r
    where r.rolname in ('anon','authenticated') and (
      has_table_privilege(r.oid,t.oid,'TRUNCATE')
      or has_table_privilege(r.oid,t.oid,'TRIGGER')))
  union all
  select 'Both sensitive buckets are private and upload-restricted', count(*) = 2
    and bool_and(not public and file_size_limit = 10485760
      and allowed_mime_types = array['image/jpeg','image/png','image/webp'])
    from storage.buckets where id in ('resident-files','report-images')
  union all
  select 'Old public storage-read policy removed', not exists (
    select 1 from pg_policies where schemaname = 'storage'
      and tablename = 'objects' and policyname = 'bbbc_storage_public_read')
  union all
  select 'Four client insert guards enabled', count(*) = 4 and bool_and(t.tgenabled = 'O')
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and t.tgname in (
      'guard_resident_profile_insert','guard_resident_record_insert',
      'guard_resident_report_insert','guard_resident_document_insert')
  union all
  select 'Sensitive storage-read policy installed', exists (
    select 1 from pg_policies where schemaname = 'storage'
      and tablename = 'objects' and policyname = 'bbbc_storage_sensitive_read')
)
select check_name, passed from checks order by check_name;
rollback;
