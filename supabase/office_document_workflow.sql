-- Apply to TEST first, after basic_resident_accounts.sql. Existing data is retained.
begin;
alter table public.document_requests
  add column if not exists workflow_version integer not null default 1,
  add column if not exists requester_capacity text not null default 'self',
  add column if not exists requester_name text,
  add column if not exists identity_evidence_method text,
  add column if not exists residency_evidence_method text,
  add column if not exists authorization_evidence_method text,
  add column if not exists identity_evidence_url text,
  add column if not exists residency_evidence_url text,
  add column if not exists authorization_evidence_url text,
  add column if not exists evidence_id_type text,
  add column if not exists identity_checked boolean not null default false,
  add column if not exists residency_checked boolean not null default false,
  add column if not exists authorization_checked boolean not null default false,
  add column if not exists office_payment_status text not null default 'pending',
  add column if not exists office_receipt_reference text,
  add column if not exists office_no_fee_reason text,
  add column if not exists pickup_confirmed boolean not null default false,
  add column if not exists collected_by text,
  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz;

create table if not exists public.document_request_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.document_requests(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  reviewed_at timestamptz not null default now(),
  review jsonb not null
);
alter table public.document_request_reviews enable row level security;
revoke all on public.document_request_reviews from public, anon, authenticated;
grant select on public.document_request_reviews to authenticated;
grant select,insert on public.document_request_reviews to service_role;
drop policy if exists document_reviews_office_read on public.document_request_reviews;
create policy document_reviews_office_read on public.document_request_reviews for select to authenticated
  using (public.is_staff_or_admin());

create or replace function public.guard_office_document_workflow()
returns trigger language plpgsql security definer set search_path = '' as $$
declare field_name text; locator text; object_path text;
begin
  if tg_op = 'INSERT' then
    if new.workflow_version <> 2 or new.status <> 'pending'
       or new.payment_method is distinct from 'office'
       or new.identity_checked or new.residency_checked or new.authorization_checked
       or new.office_payment_status <> 'pending' or new.pickup_confirmed
       or new.reviewed_by is not null or new.reviewed_at is not null
       or new.office_receipt_reference is not null or new.office_no_fee_reason is not null
       or new.collected_by is not null then
      raise exception 'New requests require office workflow, pending status and unverified checks' using errcode='42501';
    end if;
    if new.requester_capacity not in ('self','representative')
      or nullif(btrim(new.requester_name),'') is null
      or nullif(btrim(new.resident_name),'') is null
      or nullif(btrim(new.address),'') is null
      or nullif(btrim(new.purpose),'') is null
      or coalesce(new.identity_evidence_method,'') not in ('upload','in_person')
      or coalesce(new.residency_evidence_method,'') not in ('upload','in_person')
      or (new.requester_capacity='representative' and coalesce(new.authorization_evidence_method,'') not in ('upload','in_person')) then
      raise exception 'Applicant details and evidence arrangements are required' using errcode='22023';
    end if;
    if new.identity_evidence_method='upload' and nullif(btrim(new.evidence_id_type),'') is null then
      raise exception 'Identify the uploaded identity document' using errcode='22023';
    end if;
    if new.requester_capacity='self' and (new.authorization_evidence_method is not null or new.authorization_evidence_url is not null) then
      raise exception 'Self requests cannot attach representative authorization' using errcode='22023';
    end if;
    foreach field_name in array array['identity','residency','authorization'] loop
      if field_name='authorization' and new.requester_capacity='self' then continue; end if;
      if to_jsonb(new)->>(field_name || '_evidence_method')='upload' then
        locator := to_jsonb(new)->>(field_name || '_evidence_url');
        -- Only own existing private objects, never arbitrary public/external/signed URLs.
        if locator not like 'resident-files/%' then
          raise exception 'Evidence requires a private bucket path, not an external URL' using errcode='42501';
        end if;
        object_path := substr(locator, length('resident-files/')+1);
        if object_path is null or object_path='' or object_path not like new.user_id::text || '/document-evidence/%'
          or object_path ~ '(^|/)\.\.(/|$)' or object_path like '%?%'
          or not exists(select 1 from storage.objects where bucket_id='resident-files' and name=object_path) then
          raise exception 'Evidence must be an uploaded private file owned by this requester' using errcode='42501';
        end if;
      elsif to_jsonb(new)->>(field_name || '_evidence_url') is not null then
        raise exception 'In-person evidence must not include a file link' using errcode='22023';
      end if;
    end loop;
    new.fee_amount := null;
    new.fee_label := null;
  else
    if new.status is distinct from old.status then
      if not ((old.status in ('pending','awaiting_payment') and new.status in ('processing','rejected'))
        or (old.status='processing' and new.status in ('ready_for_release','rejected'))
        or (old.status='ready_for_release' and new.status in ('completed','rejected'))) then
        raise exception 'Invalid document status transition' using errcode='22023';
      end if;
      if new.status in ('ready_for_release','completed') and
        (not new.identity_checked or not new.residency_checked
          or (new.requester_capacity='representative' and not new.authorization_checked)) then
        raise exception 'Complete identity, residency and representative checks before release' using errcode='42501';
      end if;
      if new.status='completed' and
        (not new.pickup_confirmed or nullif(btrim(new.collected_by),'') is null
          or new.office_payment_status not in ('paid','no_fee')) then
        raise exception 'Office payment/no-fee decision and physical pickup confirmation are required' using errcode='42501';
      end if;
    end if;
    if new.office_payment_status not in ('pending','paid','no_fee') then
      raise exception 'Invalid office payment state' using errcode='22023';
    end if;
    if new.office_payment_status='paid' and (new.fee_amount is null or new.fee_amount<=0
      or nullif(btrim(new.office_receipt_reference),'') is null) then
      raise exception 'Record the office amount and receipt reference' using errcode='22023';
    end if;
    if new.office_payment_status='no_fee' and (new.fee_amount is distinct from 0
      or nullif(btrim(new.office_no_fee_reason),'') is null) then
      raise exception 'Record why no fee applies' using errcode='22023';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_office_document_workflow() from public,anon,authenticated;
drop trigger if exists zz_office_document_workflow on public.document_requests;
create trigger zz_office_document_workflow before insert or update on public.document_requests
  for each row execute function public.guard_office_document_workflow();

-- Office writes go through the authenticated CRM route and audited transaction.
revoke update on public.document_requests from authenticated;
create or replace function public.office_document_workflow_available()
returns boolean language sql stable as $$ select true; $$;
revoke all on function public.office_document_workflow_available() from public,anon;
grant execute on function public.office_document_workflow_available() to authenticated,service_role;
create or replace function public.review_office_document(
  p_request_id uuid, p_actor_id uuid, p_expected_status text, p_status text,
  p_identity_checked boolean, p_residency_checked boolean, p_authorization_checked boolean,
  p_payment_status text, p_fee_amount numeric, p_receipt text, p_no_fee_reason text,
  p_pickup_confirmed boolean, p_collected_by text, p_rejection_reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare updated_request public.document_requests;
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and role in ('admin','staff') and status='approved') then
    raise exception 'Active office account required' using errcode='42501';
  end if;
  select * into updated_request from public.document_requests where id=p_request_id for update;
  if not found or updated_request.status is distinct from p_expected_status then
    raise exception 'Request changed; refresh before reviewing' using errcode='40001';
  end if;
  if updated_request.status in ('completed','rejected') then
    raise exception 'Closed requests cannot be edited' using errcode='42501';
  end if;
  if p_status='rejected' and nullif(btrim(p_rejection_reason),'') is null then
    raise exception 'Explain the rejection' using errcode='22023';
  end if;
  update public.document_requests set status=p_status,
    identity_checked=p_identity_checked, residency_checked=p_residency_checked,
    authorization_checked=p_authorization_checked, office_payment_status=p_payment_status,
    fee_amount=case when p_payment_status='no_fee' then 0 when p_payment_status='paid' then p_fee_amount else null end,
    office_receipt_reference=nullif(btrim(p_receipt),''), office_no_fee_reason=nullif(btrim(p_no_fee_reason),''),
    pickup_confirmed=p_pickup_confirmed, collected_by=nullif(btrim(p_collected_by),''),
    rejection_reason=case when p_status='rejected' then p_rejection_reason else null end,
    reviewed_by=p_actor_id, reviewed_at=now(), updated_at=now()
    where id=p_request_id returning * into updated_request;
  insert into public.document_request_reviews(request_id,actor_id,review)
    values(p_request_id,p_actor_id,jsonb_build_object('status',updated_request.status,
      'identity_checked',p_identity_checked,'residency_checked',p_residency_checked,
      'authorization_checked',p_authorization_checked,'office_payment_status',p_payment_status,
      'fee_amount',updated_request.fee_amount,'receipt',updated_request.office_receipt_reference,
      'no_fee_reason',updated_request.office_no_fee_reason,'pickup_confirmed',p_pickup_confirmed,
      'collected_by',updated_request.collected_by));
  return jsonb_build_object('updated',true);
end;
$$;
revoke all on function public.review_office_document(uuid,uuid,text,text,boolean,boolean,boolean,text,numeric,text,text,boolean,text,text) from public,anon,authenticated;
grant execute on function public.review_office_document(uuid,uuid,text,text,boolean,boolean,boolean,text,numeric,text,text,boolean,text,text) to service_role;
notify pgrst,'reload schema';
commit;
