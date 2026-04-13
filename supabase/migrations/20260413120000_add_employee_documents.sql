-- Employee documents: metadata table + private storage bucket
-- Stores onboarding PDFs/DOCX, email signature HTML, contracts, etc.

create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.employees(id) on delete cascade,
  category text not null,
  name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null,
  meta jsonb not null default '{}'::jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default timezone('utc', now()),
  constraint employee_documents_category_check
    check (category in ('onboarding', 'signature', 'contract', 'id', 'other')),
  constraint employee_documents_size_check
    check (size_bytes >= 0 and size_bytes <= 26214400) -- 25 MB hard cap
);

create index if not exists idx_employee_documents_employee_category
  on public.employee_documents(employee_id, category, uploaded_at desc);

alter table public.employee_documents enable row level security;

drop policy if exists employee_documents_select on public.employee_documents;
create policy employee_documents_select
  on public.employee_documents
  for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists employee_documents_insert on public.employee_documents;
create policy employee_documents_insert
  on public.employee_documents
  for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists employee_documents_update on public.employee_documents;
create policy employee_documents_update
  on public.employee_documents
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists employee_documents_delete on public.employee_documents;
create policy employee_documents_delete
  on public.employee_documents
  for delete
  to authenticated
  using ((select public.is_admin()));

-- Private storage bucket. Files accessed only via short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'employee-documents',
  'employee-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/html',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage object policies: only admins can read/write objects in this bucket.
drop policy if exists employee_documents_objects_select on storage.objects;
create policy employee_documents_objects_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'employee-documents' and (select public.is_admin()));

drop policy if exists employee_documents_objects_insert on storage.objects;
create policy employee_documents_objects_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'employee-documents' and (select public.is_admin()));

drop policy if exists employee_documents_objects_update on storage.objects;
create policy employee_documents_objects_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'employee-documents' and (select public.is_admin()))
  with check (bucket_id = 'employee-documents' and (select public.is_admin()));

drop policy if exists employee_documents_objects_delete on storage.objects;
create policy employee_documents_objects_delete
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'employee-documents' and (select public.is_admin()));
