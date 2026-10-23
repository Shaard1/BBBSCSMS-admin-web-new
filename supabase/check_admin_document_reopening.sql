-- Read-only installation checks. These do not replace access/workflow tests.
with installed as (
  select to_regprocedure('public.reopen_office_document(uuid,uuid,timestamp with time zone,text)') as fn
)
select 'Reopening function installed' as check_name, fn is not null as passed from installed
union all
select 'Ordinary clients cannot execute reopening', coalesce(
  not has_function_privilege('anon',fn,'EXECUTE') and not has_function_privilege('authenticated',fn,'EXECUTE'),false) from installed
union all
select 'Server can execute reopening',coalesce(has_function_privilege('service_role',fn,'EXECUTE'),false) from installed
union all
select 'Reopening columns installed',count(*)=2 from information_schema.columns
where table_schema='public' and table_name='document_requests' and column_name in ('reopened_at','reopened_notice')
union all
select 'Workflow guard recognizes controlled reopening',position('app.document_reopen_id' in pg_get_functiondef('public.guard_office_document_workflow()'::regprocedure))>0;
