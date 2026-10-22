-- Test project only, after office_document_workflow.sql.
-- Validate NEW applications; preserve historical application and review snapshots.
begin;
create or replace function public.validate_document_application_fields()
returns trigger language plpgsql set search_path='' as $$
declare dob text; civil text; parsed_date date;
begin
  if new.form_data is not null and jsonb_typeof(new.form_data) <> 'object' then
    raise exception 'Application details must be a JSON object' using errcode='22023';
  end if;
  dob:=nullif(btrim(new.form_data->>'date_of_birth'),'');
  civil:=nullif(lower(btrim(new.form_data->>'civil_status')),'');
  if dob is not null then
    if dob !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Date of birth must use YYYY-MM-DD' using errcode='22023';
    end if;
    begin
      parsed_date:=dob::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception 'Choose a valid calendar date of birth' using errcode='22023';
    end;
    if parsed_date < date '1900-01-01' or parsed_date > (now() at time zone 'Asia/Manila')::date then
      raise exception 'Date of birth must not be in the future or before 1900' using errcode='22023';
    end if;
  end if;
  if civil is not null and civil not in ('single','married','widowed','separated','annulled','divorced') then
    raise exception 'Choose a civil status from the available options' using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_document_application_fields() from public,anon,authenticated;
drop trigger if exists document_application_fields_guard on public.document_requests;
create trigger document_application_fields_guard before insert on public.document_requests
for each row execute function public.validate_document_application_fields();

create or replace function public.normalize_document_review_fields()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.office_payment_status is distinct from 'paid' then
    new.office_receipt_reference:=null;
  end if;
  if new.office_payment_status is distinct from 'no_fee' then
    new.office_no_fee_reason:=null;
  end if;
  if not new.pickup_confirmed then new.collected_by:=null; end if;
  return new;
end;
$$;
revoke all on function public.normalize_document_review_fields() from public,anon,authenticated;
drop trigger if exists zz_document_review_fields_normalize on public.document_requests;
create trigger zz_document_review_fields_normalize before update on public.document_requests
for each row execute function public.normalize_document_review_fields();
notify pgrst,'reload schema';
commit;
