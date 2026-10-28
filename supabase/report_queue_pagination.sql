-- Run in the TEST project first. Additive: no existing report records or policies change.
begin;

create or replace function public.get_report_queue(
  p_search text default '',
  p_status text default 'all',
  p_category text default 'all',
  p_sort text default 'newest',
  p_page integer default 0,
  p_page_size integer default 25
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('staff', 'admin') and p.status = 'approved'
  ) then
    raise exception 'Active office account required' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('all', 'pending', 'in progress', 'resolved')
    or p_category is null or p_category not in ('all', 'Road Damage', 'Garbage Collection', 'Broken Streetlight', 'Drainage Issue', 'Noise Complaint', 'Others')
    or p_sort is null or p_sort not in ('newest', 'oldest')
    or p_page is null or p_page < 0 or p_page > 100000
    or p_page_size is null or p_page_size not between 1 and 100
    or length(coalesce(p_search, '')) > 150 then
    raise exception 'Invalid report queue filters' using errcode = '22023';
  end if;

  with normalized as materialized (
    select r.id, r.user_id, r.description, r.category, r.status, r.created_at,
      case lower(btrim(r.status))
        when 'in_process' then 'in progress' when 'in progress' then 'in progress'
        when 'resolved' then 'resolved' when 'completed' then 'resolved'
        else 'pending' end as queue_status,
      case
        when lower(btrim(r.category)) = 'garbage' then 'Garbage Collection'
        when lower(btrim(r.category)) = 'noise' then 'Noise Complaint'
        when lower(btrim(r.category)) = 'flooding' then 'Drainage Issue'
        when btrim(r.category) in ('Road Damage', 'Garbage Collection', 'Broken Streetlight', 'Drainage Issue', 'Noise Complaint', 'Others') then btrim(r.category)
        else 'Others' end as queue_category
    from public.reports r
  ), resident_names as materialized (
    -- Build the name lookup once, instead of scanning residents separately for every report.
    select distinct on (candidate.lookup_id) candidate.lookup_id, candidate.full_name
    from (
      select u.user_id as lookup_id, nullif(btrim(u.full_name), '') as full_name, 0 as priority, u.id
      from public.residents u where u.user_id is not null and nullif(btrim(u.full_name), '') is not null
      union all
      select u.id as lookup_id, nullif(btrim(u.full_name), '') as full_name, 1 as priority, u.id
      from public.residents u where nullif(btrim(u.full_name), '') is not null
    ) candidate
    order by candidate.lookup_id, candidate.priority, candidate.id
  ), named as (
    select n.*, coalesce(resident.full_name, nullif(btrim(p.full_name), ''), 'Unknown resident') as reporter_name
    from normalized n
    left join resident_names resident on resident.lookup_id = n.user_id
    left join public.profiles p on p.id = n.user_id
  ), filtered as materialized (
    select n.* from named n
    where (p_status = 'all' or n.queue_status = p_status)
      and (p_category = 'all' or n.queue_category = p_category)
      -- Literal substring search: %, _, punctuation and quotes never become SQL/filter syntax.
      and (nullif(btrim(p_search), '') is null or strpos(
        lower(concat_ws(' ', n.description, n.reporter_name, n.category, n.status)), lower(btrim(p_search))
      ) > 0)
  ), page_items as (
    select f.* from filtered f
    order by
      case when p_sort = 'newest' then f.created_at end desc,
      case when p_sort = 'oldest' then f.created_at end asc,
      f.id
    offset p_page::bigint * p_page_size limit p_page_size
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('reporter_name', i.reporter_name) order by
      case when p_sort = 'newest' then i.created_at end desc,
      case when p_sort = 'oldest' then i.created_at end asc, i.id
    ) from page_items i join public.reports r on r.id = i.id), '[]'::jsonb),
    'filteredTotal', (select count(*) from filtered),
    'summary', (select jsonb_build_object(
      'total', count(*),
      'pending', count(*) filter (where queue_status = 'pending'),
      'progress', count(*) filter (where queue_status = 'in progress'),
      'resolved', count(*) filter (where queue_status = 'resolved')
    ) from normalized)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_report_queue(text,text,text,text,integer,integer) from public, anon;
grant execute on function public.get_report_queue(text,text,text,text,integer,integer) to authenticated;

notify pgrst, 'reload schema';
commit;
