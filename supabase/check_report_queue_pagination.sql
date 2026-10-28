-- Read-only configuration checks. These do not replace access and multi-page tests.
with installed as (
  select to_regprocedure('public.get_report_queue(text,text,text,text,integer,integer)') as fn
)
select 'Report queue function installed' as check_name, fn is not null as passed from installed
union all
select 'Anonymous execution denied', coalesce(not has_function_privilege('anon', fn, 'execute'), false) from installed
union all
select 'Signed-in users can call the guarded function', coalesce(has_function_privilege('authenticated', fn, 'execute'), false) from installed
union all
select 'Office role and approval guard present', coalesce(
  position('auth.uid()' in pg_get_functiondef(fn)) > 0
  and position('p.status = ''approved''' in pg_get_functiondef(fn)) > 0
  and position('p.role in (''staff'', ''admin'')' in pg_get_functiondef(fn)) > 0, false) from installed;
