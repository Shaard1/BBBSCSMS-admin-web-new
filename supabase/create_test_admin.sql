-- TEST PROJECT ONLY: xvpyskemxgspttzjokiu.
-- This explicitly grants administrator access to the sole confirmed test account.
-- Review and run in that project's SQL Editor, never the main project.
-- Refuses to guess which account to promote if there is more than one user.
begin;
do $$
declare
  account_count bigint;
  test_user_id uuid;
  test_email text;
  test_name text;
  confirmation_time timestamptz;
begin
  select count(*) into account_count from auth.users;
  if account_count <> 1 then
    raise exception 'Expected exactly one test Auth account; found %. Select the intended account explicitly instead.', account_count;
  end if;
  select id, email, email_confirmed_at,
         coalesce(nullif(raw_user_meta_data->>'full_name', ''), 'Test Administrator')
    into test_user_id, test_email, confirmation_time, test_name
    from auth.users;
  if confirmation_time is null then
    raise exception 'Confirm the test account email before granting CRM access';
  end if;
  insert into public.profiles (id, email, full_name, role, status)
    values (test_user_id, test_email, test_name, 'admin', 'approved')
    on conflict (id) do update
      set role = 'admin', status = 'approved', email = excluded.email;
end;
$$;
select role, status from public.profiles where role = 'admin';
commit;
