-- Core schema for Cores Connect
-- Creates normalized tables based on src/data/mockData.ts

create extension if not exists pgcrypto;

create table if not exists public.employees (
  id text primary key,
  first_name text not null,
  last_name text not null,
  email text,
  personal_email text,
  role text not null,
  department text not null,
  start_date date not null,
  contract_type text not null,
  work_phone text,
  personal_phone text,
  status text not null,
  provisioning_status text not null,
  avatar text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employees_department_check check (department in ('Sales', 'Customs & Compliance', 'Transport')),
  constraint employees_contract_type_check check (contract_type in ('Permanent', 'Intern', 'Freelance')),
  constraint employees_status_check check (status in ('Active', 'Inactive', 'Onboarding')),
  constraint employees_provisioning_status_check check (provisioning_status in ('Provisioned', 'Pending', 'Failed'))
);

create table if not exists public.onboarding_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.employees(id) on delete cascade,
  task_key text not null,
  completed boolean not null default false,
  automated boolean not null default false,
  completed_at timestamptz,
  department_specific text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint onboarding_tasks_department_specific_check
    check (department_specific is null or department_specific in ('Sales', 'Customs & Compliance', 'Transport')),
  constraint onboarding_tasks_unique_per_employee unique (employee_id, task_key)
);

create table if not exists public.provisioning_items (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.employees(id) on delete cascade,
  label text not null,
  completed boolean not null default false,
  service text not null,
  item_timestamp timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint provisioning_items_service_check check (service in ('M365', 'Apple'))
);

create table if not exists public.provisioning_jobs (
  id text primary key,
  employee_id text not null references public.employees(id) on delete cascade,
  service text not null,
  status text not null,
  triggered_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint provisioning_jobs_service_check check (service in ('M365', 'Apple ID')),
  constraint provisioning_jobs_status_check check (status in ('Queued', 'Running', 'Completed', 'Failed'))
);

create table if not exists public.provisioning_job_logs (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.provisioning_jobs(id) on delete cascade,
  step text not null,
  log_timestamp timestamptz,
  status text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint provisioning_job_logs_status_check check (status in ('done', 'pending', 'error'))
);

create table if not exists public.leave_balances (
  user_id text primary key references public.employees(id) on delete cascade,
  total_annual_days integer not null default 0 check (total_annual_days >= 0),
  used_days integer not null default 0 check (used_days >= 0),
  pending_days integer not null default 0 check (pending_days >= 0),
  remaining_days integer not null default 0 check (remaining_days >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.leave_requests (
  id text primary key,
  user_id text not null references public.employees(id) on delete cascade,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  substitute_user_id text references public.employees(id) on delete set null,
  status text not null,
  created_at timestamptz not null default timezone('utc', now()),
  days integer not null check (days > 0),
  constraint leave_requests_leave_type_check check (leave_type in ('Vacation', 'Sick', 'Parental')),
  constraint leave_requests_status_check check (status in ('Pending', 'Approved', 'Rejected')),
  constraint leave_requests_dates_check check (end_date >= start_date)
);

create index if not exists idx_onboarding_tasks_employee_id on public.onboarding_tasks(employee_id);
create index if not exists idx_provisioning_items_employee_id on public.provisioning_items(employee_id);
create index if not exists idx_provisioning_jobs_employee_id on public.provisioning_jobs(employee_id);
create index if not exists idx_provisioning_jobs_status on public.provisioning_jobs(status);
create index if not exists idx_provisioning_job_logs_job_id on public.provisioning_job_logs(job_id);
create index if not exists idx_leave_requests_user_id on public.leave_requests(user_id);
create index if not exists idx_leave_requests_status on public.leave_requests(status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
before update on public.employees
for each row
execute function public.set_updated_at();

drop trigger if exists trg_onboarding_tasks_updated_at on public.onboarding_tasks;
create trigger trg_onboarding_tasks_updated_at
before update on public.onboarding_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists trg_provisioning_items_updated_at on public.provisioning_items;
create trigger trg_provisioning_items_updated_at
before update on public.provisioning_items
for each row
execute function public.set_updated_at();

drop trigger if exists trg_provisioning_jobs_updated_at on public.provisioning_jobs;
create trigger trg_provisioning_jobs_updated_at
before update on public.provisioning_jobs
for each row
execute function public.set_updated_at();

drop trigger if exists trg_leave_balances_updated_at on public.leave_balances;
create trigger trg_leave_balances_updated_at
before update on public.leave_balances
for each row
execute function public.set_updated_at();
