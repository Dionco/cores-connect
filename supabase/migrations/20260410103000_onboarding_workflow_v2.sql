-- Onboarding workflow v2 + expanded departments
-- Adds normalized workflow tables and expands department constraints

-- 1) Expand allowed departments for employee records and legacy onboarding task rows.
alter table public.employees
  drop constraint if exists employees_department_check;

alter table public.employees
  add constraint employees_department_check
  check (department in ('Sales', 'Customs & Compliance', 'Transport', 'Operations', 'Planning', 'Logistics'));

alter table public.onboarding_tasks
  drop constraint if exists onboarding_tasks_department_specific_check;

alter table public.onboarding_tasks
  add constraint onboarding_tasks_department_specific_check
  check (
    department_specific is null
    or department_specific in ('Sales', 'Customs & Compliance', 'Transport', 'Operations', 'Planning', 'Logistics')
  );

-- 2) Create onboarding workflow tables that support phase/task state model.
create table if not exists public.onboarding_workflows (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null unique references public.employees(id) on delete cascade,
  status text not null default 'not_started',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint onboarding_workflows_status_check
    check (status in ('not_started', 'in_progress', 'completed'))
);

create table if not exists public.onboarding_workflow_tasks (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.onboarding_workflows(id) on delete cascade,
  task_template_id text not null,
  status text not null default 'pending',
  completed_at timestamptz,
  completed_by text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint onboarding_workflow_tasks_status_check
    check (status in ('pending', 'in_progress', 'waiting_external', 'completed', 'skipped')),
  constraint onboarding_workflow_tasks_unique_per_workflow unique (workflow_id, task_template_id)
);

create index if not exists idx_onboarding_workflows_employee_id
  on public.onboarding_workflows(employee_id);

create index if not exists idx_onboarding_workflow_tasks_workflow_id
  on public.onboarding_workflow_tasks(workflow_id);

create index if not exists idx_onboarding_workflow_tasks_workflow_status
  on public.onboarding_workflow_tasks(workflow_id, status);

create index if not exists idx_onboarding_workflow_tasks_template
  on public.onboarding_workflow_tasks(task_template_id);

-- 3) Keep updated_at values current.
drop trigger if exists trg_onboarding_workflows_updated_at on public.onboarding_workflows;
create trigger trg_onboarding_workflows_updated_at
before update on public.onboarding_workflows
for each row
execute function public.set_updated_at();

drop trigger if exists trg_onboarding_workflow_tasks_updated_at on public.onboarding_workflow_tasks;
create trigger trg_onboarding_workflow_tasks_updated_at
before update on public.onboarding_workflow_tasks
for each row
execute function public.set_updated_at();

-- 4) Apply baseline RLS policies aligned with existing app rules.
alter table public.onboarding_workflows enable row level security;
alter table public.onboarding_workflow_tasks enable row level security;

drop policy if exists onboarding_workflows_select_authenticated on public.onboarding_workflows;
create policy onboarding_workflows_select_authenticated
  on public.onboarding_workflows
  for select
  to authenticated
  using (true);

drop policy if exists onboarding_workflows_manage_admin on public.onboarding_workflows;
create policy onboarding_workflows_manage_admin
  on public.onboarding_workflows
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists onboarding_workflow_tasks_select_authenticated on public.onboarding_workflow_tasks;
create policy onboarding_workflow_tasks_select_authenticated
  on public.onboarding_workflow_tasks
  for select
  to authenticated
  using (true);

drop policy if exists onboarding_workflow_tasks_manage_admin on public.onboarding_workflow_tasks;
create policy onboarding_workflow_tasks_manage_admin
  on public.onboarding_workflow_tasks
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
