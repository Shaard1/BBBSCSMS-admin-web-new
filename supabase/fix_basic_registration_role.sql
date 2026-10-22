-- Test-project repair: avoid PostgreSQL CURRENT_ROLE keyword collision.
begin;
create or replace function public.complete_basic_registration(
  p_full_name text, p_phone text, p_privacy_version text, p_terms_version text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  auth_email text;
  resident_profile_role text;
begin
  if caller is null then raise exception 'Sign in before completing registration' using errcode = '42501'; end if;
  if length(btrim(p_full_name)) not between 2 and 150 or p_full_name is null
    or p_phone is null or p_phone !~ '^\+639[0-9]{9}$'
    or p_privacy_version is distinct from '2026-10-21'
    or p_terms_version is distinct from '2026-10-21' then
    raise exception 'Invalid account details or notice versions' using errcode = '22023';
  end if;
  select role into resident_profile_role from public.profiles where id = caller;
  if resident_profile_role is not null and resident_profile_role <> 'resident' then
    raise exception 'Office accounts cannot become resident accounts' using errcode = '42501';
  end if;
  -- Do not silently convert legacy resident accounts or reuse their historical approvals.
  if exists (select 1 from public.residents where coalesce(user_id,id) = caller)
     and not exists (select 1 from public.resident_accounts where user_id = caller) then
    raise exception 'Existing resident accounts require a separate migration' using errcode = '42501';
  end if;
  select email into auth_email from auth.users where id = caller;
  insert into public.profiles(id,full_name,email,role,status)
    values(caller,btrim(p_full_name),auth_email,'resident','pending') on conflict (id) do nothing;
  insert into public.residents(id,user_id,full_name,email,contact_number,status)
    values(caller,caller,btrim(p_full_name),auth_email,p_phone,'pending') on conflict (id) do nothing;
  insert into public.resident_accounts(user_id,declared_phone,privacy_version,terms_version)
    values(caller,p_phone,p_privacy_version,p_terms_version) on conflict (user_id) do nothing;
  return public.get_my_resident_access();
end;
$$;
notify pgrst, 'reload schema';
commit;

