-- Test rollout after basic_resident_accounts.sql and office_document_workflow.sql.
begin;
create index if not exists residents_created_at_id_idx on public.residents(created_at desc,id);
create table if not exists public.resident_account_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  actor_id uuid not null references auth.users(id),
  previous_state text not null,
  next_state text not null,
  reason text not null check(length(btrim(reason)) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.resident_account_events enable row level security;
revoke all on public.resident_account_events from public,anon,authenticated;
grant select on public.resident_account_events to authenticated;
grant select,insert on public.resident_account_events to service_role;
drop policy if exists office_account_events_read on public.resident_account_events;
create policy office_account_events_read on public.resident_account_events for select to authenticated
  using(public.is_staff_or_admin());

create or replace function public.set_resident_account_access(
  p_user_id uuid,p_actor_id uuid,p_expected_state text,p_next_state text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actual_state text;
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and role='admin' and status='approved') then
    raise exception 'An active administrator is required' using errcode='42501';
  end if;
  if p_next_state is null or p_next_state not in ('active','suspended')
     or p_reason is null or length(btrim(p_reason)) not between 1 and 500 then
    raise exception 'Choose an access state and provide a reason (1–500 characters)' using errcode='22023';
  end if;
  select account_state into actual_state from public.resident_accounts where user_id=p_user_id for update;
  if not found then raise exception 'This action requires a basic resident account' using errcode='22023'; end if;
  if actual_state is distinct from p_expected_state then
    raise exception 'Account access changed; refresh first' using errcode='40001';
  end if;
  if actual_state=p_next_state then raise exception 'Account already has that state' using errcode='22023'; end if;
  update public.resident_accounts set account_state=p_next_state where user_id=p_user_id;
  insert into public.resident_account_events(user_id,actor_id,previous_state,next_state,reason)
    values(p_user_id,p_actor_id,actual_state,p_next_state,btrim(p_reason));
  return jsonb_build_object('updated',true);
end;
$$;
revoke all on function public.set_resident_account_access(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.set_resident_account_access(uuid,uuid,text,text,text) to service_role;

create or replace function public.get_resident_directory(
  p_search text default '',p_access text default 'all',p_phone text default 'all',
  p_page integer default 0,p_page_size integer default 25
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.is_staff_or_admin() then raise exception 'Active office account required' using errcode='42501'; end if;
  if p_access is null or p_phone is null or p_access not in ('all','active','suspended','legacy_pending','legacy_rejected')
    or p_phone not in ('all','verified','unverified','unknown')
    or p_page is null or p_page<0 or p_page>100000 or p_page_size not between 1 and 100
    or p_page_size is null or length(coalesce(p_search,''))>150 then
    raise exception 'Invalid directory filters' using errcode='22023';
  end if;
  with directory as materialized (
    select r.id,r.user_id,r.full_name,r.email,r.address,r.contact_number,r.status,r.created_at,r.profile_image,
      case when a.user_id is not null then a.account_state
        when r.status='approved' then 'active' when r.status='rejected' then 'legacy_rejected'
        else 'legacy_pending' end as access_state,
      case when a.user_id is null then 'unknown'
        when u.phone_confirmed_at is not null and ltrim(u.phone,'+')=ltrim(a.declared_phone,'+') then 'verified'
        else 'unverified' end as phone_state,
      case when a.user_id is null then null else jsonb_build_object('account_state',a.account_state,
        'identity_status',a.identity_status,'declared_phone',a.declared_phone,
        'phone_verified',coalesce(u.phone_confirmed_at is not null and ltrim(u.phone,'+')=ltrim(a.declared_phone,'+'),false)) end as basic_account
    from public.residents r left join public.resident_accounts a on a.user_id=coalesce(r.user_id,r.id)
    left join auth.users u on u.id=a.user_id
  ), filtered as materialized (
    select * from directory d where (p_access='all' or d.access_state=p_access)
      and (p_phone='all' or d.phone_state=p_phone)
      and (nullif(btrim(p_search),'') is null or concat_ws(' ',d.full_name,d.email,d.contact_number,d.basic_account->>'declared_phone',d.id::text)
        ilike '%' || btrim(p_search) || '%')
  )
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(to_jsonb(page) order by page.created_at desc,page.id) from (
      select * from filtered order by created_at desc,id offset p_page*p_page_size limit p_page_size
    ) page),'[]'::jsonb),
    'filteredTotal',(select count(*) from filtered),
    'summary',(select jsonb_build_object('total',count(*),
      'active',count(*) filter(where access_state='active'),
      'suspended',count(*) filter(where access_state='suspended'),
      'legacyPending',count(*) filter(where access_state='legacy_pending'),
      'phoneVerified',count(*) filter(where phone_state='verified')) from directory),
    'testAccess',exists(select 1 from public.resident_access_settings where singleton and environment='test' and allow_unverified_test_access)
  ) into result;
  return result;
end;
$$;
revoke all on function public.get_resident_directory(text,text,text,integer,integer) from public,anon;
grant execute on function public.get_resident_directory(text,text,text,integer,integer) to authenticated,service_role;

create or replace function public.get_resident_summary()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_staff_or_admin() then raise exception 'Active office account required' using errcode='42501'; end if;
  return (select jsonb_build_object('total',count(*),'pending',count(*) filter(where a.user_id is null and coalesce(r.status,'pending')='pending'))
    from public.residents r left join public.resident_accounts a on a.user_id=coalesce(r.user_id,r.id));
end;
$$;
revoke all on function public.get_resident_summary() from public,anon;
grant execute on function public.get_resident_summary() to authenticated,service_role;

create or replace function public.get_resident_metrics(p_year integer default extract(year from now())::integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare directory jsonb;
begin
  if not public.is_staff_or_admin() then raise exception 'Active office account required' using errcode='42501'; end if;
  if p_year is null or p_year not between 1900 and 2200 then raise exception 'Invalid year' using errcode='22023'; end if;
  directory:=public.get_resident_directory('','legacy_pending','all',0,5);
  return jsonb_build_object('summary',directory->'summary','legacyQueue',directory->'items',
    'availableYears',coalesce((select jsonb_agg(y.year order by y.year desc) from (select distinct extract(year from created_at)::integer as year from public.residents) y),'[]'::jsonb),
    'months',coalesce((select jsonb_agg(to_jsonb(m)) from (
      select extract(month from created_at)::integer-1 as month,count(*) as residents
      from public.residents where created_at>=make_date(p_year,1,1) and created_at<make_date(p_year+1,1,1)
      group by extract(month from created_at) order by month
    ) m),'[]'::jsonb));
end;
$$;
revoke all on function public.get_resident_metrics(integer) from public,anon;
grant execute on function public.get_resident_metrics(integer) to authenticated,service_role;

create or replace function public.get_resident_service_history(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_staff_or_admin() then raise exception 'Active office account required' using errcode='42501'; end if;
  return jsonb_build_object(
    'documents',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from (
      select id,certificate_title,status,identity_checked,residency_checked,authorization_checked,
        requester_capacity,reviewed_at,created_at from public.document_requests where user_id=p_user_id
        order by created_at desc limit 20
    ) d),'[]'::jsonb),
    'reportCount',(select count(*) from public.reports where user_id=p_user_id),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (
      select e.previous_state,e.next_state,e.reason,e.created_at,p.full_name as actor_name
      from public.resident_account_events e left join public.profiles p on p.id=e.actor_id
      where e.user_id=p_user_id order by e.created_at desc limit 20
    ) e),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_resident_service_history(uuid) from public,anon;
grant execute on function public.get_resident_service_history(uuid) to authenticated,service_role;

-- Expose the canonical declared number separately from an editable contact number.
create or replace function public.get_my_resident_access()
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('account_state',a.account_state,'identity_status',a.identity_status,
    'declared_phone',a.declared_phone,
    'phone_verified',coalesce(u.phone_confirmed_at is not null and ltrim(u.phone,'+')=ltrim(a.declared_phone,'+'),false),
    'basic_access',public.resident_basic_access(),
    'test_access',exists(select 1 from public.resident_access_settings where singleton and environment='test' and allow_unverified_test_access))
  from public.resident_accounts a join auth.users u on u.id=a.user_id where a.user_id=auth.uid();
$$;
notify pgrst,'reload schema';
commit;
