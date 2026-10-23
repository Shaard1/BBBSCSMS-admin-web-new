-- TEST project first, after office_document_workflow.sql and document_detail_validation.sql.
-- Existing requests are retained; no request is automatically reopened.
begin;
alter table public.document_requests
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_notice text;
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
       or new.collected_by is not null or new.reopened_at is not null or new.reopened_notice is not null then
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
    if (new.reopened_at is distinct from old.reopened_at or new.reopened_notice is distinct from old.reopened_notice)
      and current_setting('app.document_reopen_id',true) is distinct from old.id::text then
      raise exception 'Reopening metadata requires the reopening action' using errcode='42501';
    end if;
    -- Only the service-only reopening transaction may reverse a completion.
    if old.status='completed' and new.status='ready_for_release'
      and current_setting('app.document_reopen_id',true)=old.id::text then
      if new.pickup_confirmed or new.collected_by is not null
        or new.reopened_at is null
        or not new.identity_checked or not new.residency_checked
        or (new.requester_capacity='representative' and not new.authorization_checked)
        or not exists(select 1 from public.profiles where id=new.reviewed_by and role='admin' and status='approved')
        or (to_jsonb(new)-array['status','pickup_confirmed','collected_by','reviewed_by','reviewed_at','updated_at','reopened_at','reopened_notice'])
          is distinct from (to_jsonb(old)-array['status','pickup_confirmed','collected_by','reviewed_by','reviewed_at','updated_at','reopened_at','reopened_notice']) then
        raise exception 'Invalid reopening change' using errcode='42501';
      end if;
      return new;
    end if;
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

create or replace function public.reopen_office_document(
  p_request_id uuid, p_actor_id uuid, p_expected_updated_at timestamptz, p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare original public.document_requests; reopened public.document_requests;
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and role='admin' and status='approved') then
    raise exception 'Only an active administrator can reopen completed requests' using errcode='42501';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then
    raise exception 'Explain the reopening in 10 to 1000 characters' using errcode='22023';
  end if;
  select * into original from public.document_requests where id=p_request_id for update;
  if not found or original.status<>'completed' or original.updated_at is distinct from p_expected_updated_at then
    raise exception 'Request changed; refresh before reopening' using errcode='40001';
  end if;
  perform set_config('app.document_reopen_id',p_request_id::text,true);
  update public.document_requests set status='ready_for_release',pickup_confirmed=false,collected_by=null,
    reviewed_by=p_actor_id,reviewed_at=now(),updated_at=now(),reopened_at=now(),
    reopened_notice='The previous completion was corrected by the barangay office. Your document is ready for collection.'
    where id=p_request_id returning * into reopened;
  perform set_config('app.document_reopen_id','',true);
  insert into public.document_request_reviews(request_id,actor_id,review)
    values(p_request_id,p_actor_id,jsonb_build_object('action','reopened','status',reopened.status,
      'reason',btrim(p_reason),'previous_status',original.status,
      'previous_pickup_confirmed',original.pickup_confirmed,'previous_collected_by',original.collected_by,
      'previous_reviewed_at',original.reviewed_at,'previous_updated_at',original.updated_at,
      'identity_checked',reopened.identity_checked,'residency_checked',reopened.residency_checked,
      'authorization_checked',reopened.authorization_checked,'office_payment_status',reopened.office_payment_status,
      'fee_amount',reopened.fee_amount,'receipt',reopened.office_receipt_reference,
      'no_fee_reason',reopened.office_no_fee_reason,'pickup_confirmed',false,'collected_by',null));
  return jsonb_build_object('updated',true);
end;
$$;
revoke all on function public.reopen_office_document(uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.reopen_office_document(uuid,uuid,timestamptz,text) to service_role;
notify pgrst,'reload schema';
commit;

