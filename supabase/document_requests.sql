begin;

create table if not exists public.document_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  resident_id uuid,
  resident_name text not null,
  certificate_key text not null,
  certificate_title text not null,
  certificate_variant text,
  contact_number text,
  email text,
  address text,
  payment_method text,
  payment_receiver_name text,
  payment_receiver_number text,
  payment_reference text,
  payment_proof_url text,
  payment_submitted_at timestamptz,
  fee_label text,
  fee_amount numeric(10, 2),
  purpose text,
  additional_notes text,
  form_data jsonb not null default '{}'::jsonb,
  rejection_reason text,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint document_requests_status_check check (
    status in (
      'pending',
      'awaiting_payment',
      'processing',
      'ready_for_release',
      'completed',
      'rejected'
    )
  )
);

alter table public.document_requests
  add column if not exists payment_receiver_name text,
  add column if not exists payment_receiver_number text,
  add column if not exists payment_reference text,
  add column if not exists payment_proof_url text,
  add column if not exists payment_submitted_at timestamptz;

create index if not exists document_requests_created_at_idx
  on public.document_requests (created_at desc);

create index if not exists document_requests_status_idx
  on public.document_requests (status);

create index if not exists document_requests_user_id_idx
  on public.document_requests (user_id);

drop policy if exists "Residents can insert their own document requests" on public.document_requests;
drop policy if exists "Residents can view their own document requests" on public.document_requests;
drop policy if exists "Office accounts can review all document requests" on public.document_requests;
drop policy if exists "Office accounts can update document requests" on public.document_requests;

alter table public.document_requests enable row level security;

create policy "Residents can insert their own document requests"
  on public.document_requests
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Residents can view their own document requests"
  on public.document_requests
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Office accounts can review all document requests"
  on public.document_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'staff')
    )
  );

create policy "Office accounts can update document requests"
  on public.document_requests
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'staff')
    )
  );

commit;
