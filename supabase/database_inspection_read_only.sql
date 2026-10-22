-- Bancao Connect: metadata inspection only. This is NOT a migration.
-- Run in the Supabase SQL Editor and export/copy the inspection_report value.
-- No resident rows, Auth users, storage objects, or credentials are queried.
-- Function bodies are included to inspect authorization logic. Before sharing,
-- redact any hardcoded credentials if existing functions contain them.
-- No policies, functions, tables, or records are created or changed.

begin transaction read only;

with target_tables as (
  select c.oid, n.nspname as schema_name, c.relname as table_name,
         c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
         pg_get_userbyid(c.relowner) as table_owner
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p')
    and (
      (n.nspname = 'public' and c.relname in (
        'profiles', 'residents', 'reports', 'announcements',
        'announcement_reads', 'document_requests',
        'rls_policies_backup_2026_05_21'
      ))
      or (n.nspname = 'storage' and c.relname in ('objects', 'buckets'))
    )
), relevant_triggers as (
  select t.oid, t.tgfoid as function_oid, n.nspname as schema_name,
         c.relname as table_name, t.tgname as trigger_name,
         t.tgenabled as enabled_mode,
         pg_get_triggerdef(t.oid, true) as definition
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and (c.oid in (select oid from target_tables)
         or (n.nspname = 'auth' and c.relname = 'users'))
), relevant_functions as (
  select p.oid, n.nspname as schema_name, p.proname as function_name,
         pg_get_function_identity_arguments(p.oid) as arguments,
         p.prosecdef as security_definer,
         pg_get_userbyid(p.proowner) as function_owner,
         p.proconfig as settings, p.proacl::text as explicit_acl,
         pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.prokind = 'f'
    and (
      (n.nspname = 'public' and p.proname in (
        'is_admin', 'is_staff_or_admin',
        'prevent_profile_self_escalation',
        'prevent_resident_protected_updates',
        'prevent_report_protected_updates'
      ))
      or p.oid in (select function_oid from relevant_triggers)
    )
)
select jsonb_build_object(
  'inspection_time_utc', timezone('utc', now()),
  'tables', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.schema_name, x.table_name)
    from (
      select schema_name, table_name, rls_enabled, rls_forced, table_owner
      from target_tables
    ) x
  ), '[]'::jsonb),
  'columns', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.schema_name, x.table_name, x.position)
    from (
      select tt.schema_name, tt.table_name, a.attnum as position,
             a.attname as column_name,
             format_type(a.atttypid, a.atttypmod) as data_type,
             a.attnotnull as not_null,
             pg_get_expr(d.adbin, d.adrelid) as default_expression,
             a.attacl::text as explicit_column_acl
      from target_tables tt
      join pg_attribute a on a.attrelid = tt.oid
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attnum > 0 and not a.attisdropped
    ) x
  ), '[]'::jsonb),
  'constraints', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.schema_name, x.table_name, x.constraint_name)
    from (
      select tt.schema_name, tt.table_name, c.conname as constraint_name,
             c.contype as constraint_type, c.convalidated as validated,
             pg_get_constraintdef(c.oid, true) as definition
      from target_tables tt
      join pg_constraint c on c.conrelid = tt.oid
    ) x
  ), '[]'::jsonb),
  'indexes', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.schemaname, x.tablename, x.indexname)
    from (
      select i.schemaname, i.tablename, i.indexname, i.indexdef
      from pg_indexes i
      join target_tables tt
        on tt.schema_name = i.schemaname and tt.table_name = i.tablename
    ) x
  ), '[]'::jsonb),
  'policies', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.schemaname, x.tablename, x.policyname)
    from (
      select p.schemaname, p.tablename, p.policyname, p.permissive,
             p.roles, p.cmd, p.qual, p.with_check
      from pg_policies p
      join target_tables tt
        on tt.schema_name = p.schemaname and tt.table_name = p.tablename
    ) x
  ), '[]'::jsonb),
  'triggers', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.schema_name, x.table_name, x.trigger_name)
    from (
      select schema_name, table_name, trigger_name, enabled_mode, definition
      from relevant_triggers
    ) x
  ), '[]'::jsonb),
  'functions', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.schema_name, x.function_name, x.arguments)
    from (
      select schema_name, function_name, arguments, security_definer,
             function_owner, settings, explicit_acl, definition
      from relevant_functions
    ) x
  ), '[]'::jsonb),
  'client_table_privileges', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.schema_name, x.table_name, x.role_name)
    from (
      select tt.schema_name, tt.table_name, r.rolname as role_name,
             has_table_privilege(r.oid, tt.oid, 'SELECT') as can_select,
             has_table_privilege(r.oid, tt.oid, 'INSERT') as can_insert,
             has_table_privilege(r.oid, tt.oid, 'UPDATE') as can_update,
             has_table_privilege(r.oid, tt.oid, 'DELETE') as can_delete,
             has_table_privilege(r.oid, tt.oid, 'TRUNCATE') as can_truncate,
             has_table_privilege(r.oid, tt.oid, 'TRIGGER') as can_create_trigger
      from target_tables tt
      cross join pg_roles r
      where r.rolname in ('anon', 'authenticated')
    ) x
  ), '[]'::jsonb),
  'client_function_privileges', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.schema_name, x.function_name, x.arguments, x.role_name)
    from (
      select f.schema_name, f.function_name, f.arguments, r.rolname as role_name,
             has_function_privilege(r.oid, f.oid, 'EXECUTE') as can_execute
      from relevant_functions f
      cross join pg_roles r
      where r.rolname in ('anon', 'authenticated')
    ) x
  ), '[]'::jsonb),
  'storage_buckets', coalesce((
    select jsonb_agg(to_jsonb(x) order by x.id)
    from (
      select id, name, public, file_size_limit, allowed_mime_types
      from storage.buckets
    ) x
  ), '[]'::jsonb)
) as inspection_report;

rollback;
