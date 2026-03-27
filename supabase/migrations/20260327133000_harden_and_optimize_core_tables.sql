-- Security and performance hardening for core tables
-- Follow-up migration for 20260327120000_create_core_tables.sql

-- 1) Data integrity improvements
alter table public.leave_balances
  drop constraint if exists leave_balances_consistency_check;

alter table public.leave_balances
  add constraint leave_balances_consistency_check
  check (remaining_days = total_annual_days - used_days - pending_days);

-- 2) Service vocabulary normalization
alter table public.provisioning_items
  drop constraint if exists provisioning_items_service_check;

update public.provisioning_items
set service = 'Apple ID'
where service = 'Apple';

alter table public.provisioning_items
  add constraint provisioning_items_service_check
  check (service in ('M365', 'Apple ID'));

-- 3) Targeted indexes for common UI query shapes
create index if not exists idx_employees_status_department_start_date
  on public.employees(status, department, start_date desc);

create index if not exists idx_employees_start_date
  on public.employees(start_date desc);

create unique index if not exists uq_employees_email_lower_not_blank
  on public.employees(lower(email))
  where email is not null and btrim(email) <> '';

create unique index if not exists uq_employees_personal_email_lower_not_blank
  on public.employees(lower(personal_email))
  where personal_email is not null and btrim(personal_email) <> '';

create index if not exists idx_onboarding_tasks_employee_completed
  on public.onboarding_tasks(employee_id, completed);

create index if not exists idx_provisioning_items_employee_completed
  on public.provisioning_items(employee_id, completed);

create index if not exists idx_provisioning_jobs_active_queue
  on public.provisioning_jobs(triggered_at desc)
  where status in ('Queued', 'Running');

create index if not exists idx_leave_requests_status_created_at
  on public.leave_requests(status, created_at desc);

create index if not exists idx_leave_requests_user_created_at
  on public.leave_requests(user_id, created_at desc);

create index if not exists idx_leave_requests_pending_created_at
  on public.leave_requests(created_at desc)
  where status = 'Pending';

-- 4) Row Level Security baseline
-- This is a safe starting point for an internal app:
-- - authenticated users can read
-- - admin users (JWT app_metadata.role in ['admin','hr_admin']) can mutate
-- Tighten these policies after introducing explicit auth-user -> employee mapping.

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'hr_admin');
$$;

alter table public.employees enable row level security;
alter table public.onboarding_tasks enable row level security;
alter table public.provisioning_items enable row level security;
alter table public.provisioning_jobs enable row level security;
alter table public.provisioning_job_logs enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;

drop policy if exists employees_select_authenticated on public.employees;
create policy employees_select_authenticated
  on public.employees
  for select
  to authenticated
  using (true);

drop policy if exists employees_manage_admin on public.employees;
create policy employees_manage_admin
  on public.employees
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists onboarding_tasks_select_authenticated on public.onboarding_tasks;
create policy onboarding_tasks_select_authenticated
  on public.onboarding_tasks
  for select
  to authenticated
  using (true);

drop policy if exists onboarding_tasks_manage_admin on public.onboarding_tasks;
create policy onboarding_tasks_manage_admin
  on public.onboarding_tasks
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists provisioning_items_select_authenticated on public.provisioning_items;
create policy provisioning_items_select_authenticated
  on public.provisioning_items
  for select
  to authenticated
  using (true);

drop policy if exists provisioning_items_manage_admin on public.provisioning_items;
create policy provisioning_items_manage_admin
  on public.provisioning_items
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists provisioning_jobs_select_authenticated on public.provisioning_jobs;
create policy provisioning_jobs_select_authenticated
  on public.provisioning_jobs
  for select
  to authenticated
  using (true);

drop policy if exists provisioning_jobs_manage_admin on public.provisioning_jobs;
create policy provisioning_jobs_manage_admin
  on public.provisioning_jobs
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists provisioning_job_logs_select_authenticated on public.provisioning_job_logs;
create policy provisioning_job_logs_select_authenticated
  on public.provisioning_job_logs
  for select
  to authenticated
  using (true);

drop policy if exists provisioning_job_logs_manage_admin on public.provisioning_job_logs;
create policy provisioning_job_logs_manage_admin
  on public.provisioning_job_logs
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists leave_balances_select_authenticated on public.leave_balances;
create policy leave_balances_select_authenticated
  on public.leave_balances
  for select
  to authenticated
  using (true);

drop policy if exists leave_balances_manage_admin on public.leave_balances;
create policy leave_balances_manage_admin
  on public.leave_balances
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists leave_requests_select_authenticated on public.leave_requests;
create policy leave_requests_select_authenticated
  on public.leave_requests
  for select
  to authenticated
  using (true);

drop policy if exists leave_requests_manage_admin on public.leave_requests;
create policy leave_requests_manage_admin
  on public.leave_requests
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
