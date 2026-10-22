-- TEST PROJECT ONLY: xvpyskemxgspttzjokiu. Never run against the main project.
-- Reconstructed from the supplied 2026-10-20 metadata; no resident data copied.
-- Fresh-project setup, not a migration for an existing database.
-- Apply security_followup.sql immediately afterward, then database_security_checks.sql.
begin;
set local search_path = public, pg_catalog;
do $$
begin
  if exists (select 1 from pg_tables where schemaname='public'
    and tablename in ('profiles','residents','reports','announcements','announcement_reads','document_requests')) then
    raise exception 'Fresh TEST project required: application tables already exist. Nothing changed.';
  end if;
end;
$$;
create table public."profiles" (
  "id" uuid not null,
  "full_name" text default ''::text not null,
  "email" text,
  "role" text default 'resident'::text not null,
  "status" text default 'pending'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table public."residents" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "full_name" text default ''::text not null,
  "birthdate" date,
  "address" text,
  "contact_number" text,
  "civil_status" text,
  "gender" text,
  "id_type" text,
  "id_image" text,
  "id_image_front" text,
  "id_image_back" text,
  "profile_image" text,
  "profile_image_original" text,
  "rejection_reason" text,
  "status" text default 'pending'::text not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null,
  "email" text,
  "birth_day" text,
  "birth_month" text,
  "birth_year" text
);
create table public."reports" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "description" text,
  "image_url" text,
  "image_urls" text[],
  "category" text,
  "latitude" numeric,
  "longitude" numeric,
  "status" text default 'pending'::text not null,
  "admin_note" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table public."announcements" (
  "id" uuid default gen_random_uuid() not null,
  "title" text not null,
  "content" text not null,
  "thumbnail_url" text,
  "image_urls" text[] default '{}'::text[],
  "is_published" boolean default true not null,
  "created_by" uuid,
  "created_by_name" text,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
create table public."announcement_reads" (
  "user_id" uuid not null,
  "announcement_id" uuid not null,
  "read_at" timestamp with time zone default now() not null
);
create table public."document_requests" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "resident_id" uuid,
  "resident_name" text not null,
  "certificate_key" text not null,
  "certificate_title" text not null,
  "certificate_variant" text,
  "contact_number" text,
  "email" text,
  "address" text,
  "payment_method" text,
  "fee_label" text,
  "fee_amount" numeric(10,2),
  "purpose" text,
  "additional_notes" text,
  "form_data" jsonb default '{}'::jsonb not null,
  "rejection_reason" text,
  "status" text default 'pending'::text not null,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "updated_at" timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public."residents" add constraint "residents_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));
alter table public."residents" add constraint "residents_pkey" PRIMARY KEY (id);
alter table public."reports" add constraint "reports_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'in progress'::text, 'resolved'::text]));
alter table public."reports" add constraint "reports_pkey" PRIMARY KEY (id);
alter table public."profiles" add constraint "profiles_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]));
alter table public."profiles" add constraint "profiles_role_check" CHECK (role = ANY (ARRAY['resident'::text, 'staff'::text, 'admin'::text]));
alter table public."residents" add constraint "residents_user_id_key" UNIQUE (user_id);
alter table public."document_requests" add constraint "document_requests_status_check" CHECK (status = ANY (ARRAY['pending'::text, 'awaiting_payment'::text, 'processing'::text, 'ready_for_release'::text, 'completed'::text, 'rejected'::text]));
alter table public."document_requests" add constraint "document_requests_pkey" PRIMARY KEY (id);
alter table public."announcements" add constraint "announcements_pkey" PRIMARY KEY (id);
alter table public."announcement_reads" add constraint "announcement_reads_pkey" PRIMARY KEY (user_id, announcement_id);
alter table public."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."residents" add constraint "residents_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."announcements" add constraint "announcements_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."reports" add constraint "reports_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."announcement_reads" add constraint "announcement_reads_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public."document_requests" add constraint "document_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."announcement_reads" add constraint "announcement_reads_announcement_id_fkey" FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE;
CREATE INDEX document_requests_created_at_idx ON public.document_requests USING btree (created_at DESC);
CREATE INDEX document_requests_status_idx ON public.document_requests USING btree (status);
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from profiles
    where id = auth.uid()
      and role = 'admin'
  );
$function$;
CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from profiles
    where id = auth.uid()
      and role in ('staff', 'admin')
  );
$function$;
CREATE OR REPLACE FUNCTION public.prevent_profile_self_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if old.id = auth.uid() and not public.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Users cannot change their own profile role or status';
    end if;
  end if;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.prevent_report_protected_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if old.user_id = auth.uid() and not public.is_staff_or_admin() then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.status is distinct from old.status
      or new.admin_note is distinct from old.admin_note then
      raise exception 'Residents cannot change report workflow fields';
    end if;
  end if;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.prevent_resident_protected_updates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if old.user_id = auth.uid() and not public.is_staff_or_admin() then
    if new.id is distinct from old.id
      or new.user_id is distinct from old.user_id
      or new.status is distinct from old.status
      or new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'Residents cannot change protected verification fields';
    end if;
  end if;

  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
CREATE TRIGGER announcements_set_updated_at BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER prevent_profile_self_escalation BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION prevent_profile_self_escalation();
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER prevent_report_protected_updates BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION prevent_report_protected_updates();
CREATE TRIGGER reports_set_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER prevent_resident_protected_updates BEFORE UPDATE ON residents FOR EACH ROW EXECUTE FUNCTION prevent_resident_protected_updates();
CREATE TRIGGER residents_set_updated_at BEFORE UPDATE ON residents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
alter table public."profiles" enable row level security;
grant select, insert, update, delete on public."profiles" to authenticated, service_role;
alter table public."residents" enable row level security;
grant select, insert, update, delete on public."residents" to authenticated, service_role;
alter table public."reports" enable row level security;
grant select, insert, update, delete on public."reports" to authenticated, service_role;
alter table public."announcements" enable row level security;
grant select, insert, update, delete on public."announcements" to authenticated, service_role;
alter table public."announcement_reads" enable row level security;
grant select, insert, update, delete on public."announcement_reads" to authenticated, service_role;
alter table public."document_requests" enable row level security;
grant select, insert, update, delete on public."document_requests" to authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create policy "announcement_reads_insert_own" on public."announcement_reads" as PERMISSIVE for INSERT to "authenticated" with check ((user_id = auth.uid()));
create policy "announcement_reads_select_own" on public."announcement_reads" as PERMISSIVE for SELECT to "authenticated" using ((user_id = auth.uid()));
create policy "announcement_reads_update_own" on public."announcement_reads" as PERMISSIVE for UPDATE to "authenticated" using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "announcements_delete_office" on public."announcements" as PERMISSIVE for DELETE to "authenticated" using (is_staff_or_admin());
create policy "announcements_insert_office" on public."announcements" as PERMISSIVE for INSERT to "authenticated" with check ((is_staff_or_admin() AND ((created_by IS NULL) OR (created_by = auth.uid()))));
create policy "announcements_select_published_or_office" on public."announcements" as PERMISSIVE for SELECT to "authenticated" using (((is_published = true) OR is_staff_or_admin()));
create policy "announcements_update_office" on public."announcements" as PERMISSIVE for UPDATE to "authenticated" using (is_staff_or_admin()) with check (is_staff_or_admin());
create policy "Office accounts can review all document requests" on public."document_requests" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'staff'::text]))))));
create policy "Office accounts can update document requests" on public."document_requests" as PERMISSIVE for UPDATE to "authenticated" using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'staff'::text])))))) with check ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'staff'::text]))))));
create policy "Residents can insert their own document requests" on public."document_requests" as PERMISSIVE for INSERT to "authenticated" with check ((auth.uid() = user_id));
create policy "Residents can view their own document requests" on public."document_requests" as PERMISSIVE for SELECT to "authenticated" using ((auth.uid() = user_id));
create policy "profiles_insert_admin" on public."profiles" as PERMISSIVE for INSERT to "authenticated" with check (is_admin());
create policy "profiles_insert_own_resident" on public."profiles" as PERMISSIVE for INSERT to "authenticated" with check (((id = auth.uid()) AND (lower(TRIM(BOTH FROM COALESCE(role, 'resident'::text))) = 'resident'::text)));
create policy "profiles_select_self_or_office" on public."profiles" as PERMISSIVE for SELECT to "authenticated" using (((id = auth.uid()) OR is_staff_or_admin()));
create policy "profiles_update_admin" on public."profiles" as PERMISSIVE for UPDATE to "authenticated" using (is_admin()) with check (is_admin());
create policy "profiles_update_own_resident" on public."profiles" as PERMISSIVE for UPDATE to "authenticated" using (((id = auth.uid()) AND (lower(TRIM(BOTH FROM COALESCE(role, 'resident'::text))) = 'resident'::text))) with check (((id = auth.uid()) AND (lower(TRIM(BOTH FROM COALESCE(role, 'resident'::text))) = 'resident'::text)));
create policy "reports_delete_own_or_admin" on public."reports" as PERMISSIVE for DELETE to "authenticated" using (((user_id = auth.uid()) OR is_admin()));
create policy "reports_insert_own" on public."reports" as PERMISSIVE for INSERT to "authenticated" with check ((user_id = auth.uid()));
create policy "reports_select_own_or_office" on public."reports" as PERMISSIVE for SELECT to "authenticated" using (((user_id = auth.uid()) OR is_staff_or_admin()));
create policy "reports_update_own_or_office" on public."reports" as PERMISSIVE for UPDATE to "authenticated" using (((user_id = auth.uid()) OR is_staff_or_admin())) with check (((user_id = auth.uid()) OR is_staff_or_admin()));
create policy "residents_insert_own_or_office" on public."residents" as PERMISSIVE for INSERT to "authenticated" with check (((id = auth.uid()) OR (user_id = auth.uid()) OR is_staff_or_admin()));
create policy "residents_select_own_or_office" on public."residents" as PERMISSIVE for SELECT to "authenticated" using (((id = auth.uid()) OR (user_id = auth.uid()) OR is_staff_or_admin()));
create policy "residents_update_own_or_office" on public."residents" as PERMISSIVE for UPDATE to "authenticated" using (((id = auth.uid()) OR (user_id = auth.uid()) OR is_staff_or_admin())) with check (((id = auth.uid()) OR (user_id = auth.uid()) OR is_staff_or_admin()));
-- Private immediately; security_followup.sql adds authorized signed reads.
insert into storage.buckets (id,name,public) values
 ('resident-files','resident-files',false),
 ('report-images','report-images',false),
 ('announcement-files','announcement-files',true)
on conflict (id) do nothing;
create policy bbbc_storage_resident_files_insert on storage.objects for insert to authenticated
 with check (bucket_id='resident-files' and (storage.foldername(name))[1]=auth.uid()::text);
create policy bbbc_storage_resident_files_update on storage.objects for update to authenticated
 using (bucket_id='resident-files' and (storage.foldername(name))[1]=auth.uid()::text)
 with check (bucket_id='resident-files' and (storage.foldername(name))[1]=auth.uid()::text);
create policy bbbc_storage_report_images_insert on storage.objects for insert to authenticated
 with check (bucket_id='report-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy bbbc_storage_report_images_update on storage.objects for update to authenticated
 using (bucket_id='report-images' and (storage.foldername(name))[1]=auth.uid()::text)
 with check (bucket_id='report-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy bbbc_storage_announcement_files_insert on storage.objects for insert to authenticated
 with check (bucket_id='announcement-files' and public.is_staff_or_admin());
create policy bbbc_storage_announcement_files_update on storage.objects for update to authenticated
 using (bucket_id='announcement-files' and public.is_staff_or_admin())
 with check (bucket_id='announcement-files' and public.is_staff_or_admin());
commit;
