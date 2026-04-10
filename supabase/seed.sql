-- Seed data for Cores Connect
-- Executed by Supabase CLI on `supabase db reset`.

begin;

truncate table public.provisioning_job_logs,
  public.provisioning_jobs,
  public.provisioning_items,
  public.onboarding_tasks,
  public.notifications,
  public.leave_requests,
  public.leave_balances,
  public.employees
restart identity cascade;

insert into public.employees (
  id,
  first_name,
  last_name,
  email,
  personal_email,
  role,
  department,
  start_date,
  contract_type,
  work_phone,
  personal_phone,
  status,
  provisioning_status,
  avatar
)
values
  ('emp-001', 'Sophie', 'de Vries', 'sophie@cores.nl', 'sophie.devries@gmail.com', 'Sales Manager', 'Sales', '2025-01-15', 'Permanent', '+31 6 1234 5678', '+31 6 8765 4321', 'Active', 'Provisioned', null),
  ('emp-002', 'Jan', 'Bakker', 'jan@cores.nl', 'jan.bakker@outlook.com', 'Customs Specialist', 'Customs & Compliance', '2025-03-01', 'Permanent', '+31 6 2345 6789', '+31 6 9876 5432', 'Active', 'Provisioned', null),
  ('emp-003', 'Emma', 'Jansen', 'emma@cores.nl', 'emma.jansen@gmail.com', 'Transport Coordinator', 'Transport', '2025-06-10', 'Permanent', '+31 6 3456 7890', '+31 6 0987 6543', 'Active', 'Provisioned', null),
  ('emp-004', 'Daan', 'Visser', 'daan@cores.nl', 'daan.visser@gmail.com', 'Sales Representative', 'Sales', '2025-09-01', 'Permanent', '+31 6 4567 8901', '+31 6 1098 7654', 'Active', 'Provisioned', null),
  ('emp-005', 'Lisa', 'van den Berg', 'lisa@cores.nl', 'lisa.vdberg@outlook.com', 'Compliance Officer', 'Customs & Compliance', '2025-11-15', 'Permanent', '+31 6 5678 9012', '+31 6 2109 8765', 'Active', 'Provisioned', null),
  ('emp-006', 'Thomas', 'Mulder', 'thomas@cores.nl', 'thomas.mulder@gmail.com', 'Warehouse Manager', 'Transport', '2026-01-10', 'Permanent', '+31 6 6789 0123', '+31 6 3210 9876', 'Active', 'Provisioned', null),
  ('emp-007', 'Fleur', 'Hendriks', 'fleur@cores.nl', 'fleur.hendriks@gmail.com', 'Sales Intern', 'Sales', '2026-03-01', 'Intern', '+31 6 7890 1234', '+31 6 4321 0987', 'Onboarding', 'Provisioned', null),
  ('emp-008', 'Niels', 'de Groot', 'niels@cores.nl', 'niels.degroot@outlook.com', 'Freight Forwarder', 'Transport', '2026-03-10', 'Permanent', '+31 6 8901 2345', '+31 6 5432 1098', 'Onboarding', 'Pending', null),
  ('emp-009', 'Mila', 'Smit', 'mila@cores.nl', 'mila.smit@gmail.com', 'Customs Declarant', 'Customs & Compliance', '2026-03-18', 'Permanent', '', '+31 6 6543 2109', 'Onboarding', 'Pending', null),
  ('emp-010', 'Bram', 'Willems', '', 'bram.willems@gmail.com', 'Account Manager', 'Sales', '2024-05-01', 'Permanent', '+31 6 9012 3456', '+31 6 7654 3210', 'Inactive', 'Provisioned', null);

with task_template as (
  select *
  from (
    values
      (1, 'task.m365Created', true, true, '2026-03-15 09:00'::timestamptz),
      (2, 'task.licenseAssigned', true, true, '2026-03-15 09:01'::timestamptz),
      (3, 'task.emailConfigured', true, true, '2026-03-15 09:02'::timestamptz),
      (4, 'task.sharedMailboxTrading', true, true, '2026-03-15 09:03'::timestamptz),
      (5, 'task.departmentSpecific', true, true, '2026-03-15 09:03'::timestamptz),
      (6, 'task.sharepointGroup', true, true, '2026-03-15 09:04'::timestamptz),
      (7, 'task.appleBusinessManager', true, true, '2026-03-15 09:05'::timestamptz),
      (8, 'task.loginPdf', false, false, null),
      (9, 'task.sliteInvite', false, false, null),
      (10, 'task.tribeCrmInvite', false, false, null)
  ) as t(seq, task_key, completed_default, automated, completed_at_default)
)
insert into public.onboarding_tasks (
  employee_id,
  task_key,
  completed,
  automated,
  completed_at,
  department_specific
)
select
  e.id,
  case
    when tt.seq = 5 and e.department = 'Sales' then 'task.sharedMailboxSales'
    when tt.seq = 5 and e.department = 'Customs & Compliance' then 'task.sharedMailboxCustoms'
    when tt.seq = 5 and e.department = 'Transport' then 'task.sharedMailboxTransport'
    else tt.task_key
  end as task_key,
  case
    when e.id = 'emp-008' then tt.seq <= 4
    when e.id = 'emp-009' then tt.seq <= 2
    when e.id = 'emp-007' then true
    else true
  end as completed,
  tt.automated,
  case
    when e.id = 'emp-008' then case when tt.seq <= 4 then tt.completed_at_default else null end
    when e.id = 'emp-009' then case when tt.seq <= 2 then tt.completed_at_default else null end
    when e.id = 'emp-007' then tt.completed_at_default
    else coalesce(tt.completed_at_default, (e.start_date::text || ' 10:00')::timestamptz)
  end as completed_at,
  case
    when tt.seq = 5 then e.department
    else null
  end as department_specific
from public.employees e
cross join task_template tt;

with item_template as (
  select *
  from (
    values
      (1, 'Email created', 'M365', '2026-03-15 09:00'::timestamptz),
      (2, 'Business Premium licence assigned', 'M365', '2026-03-15 09:01'::timestamptz),
      (3, 'Shared mailboxes added', 'M365', '2026-03-15 09:03'::timestamptz),
      (4, 'SharePoint access granted', 'M365', '2026-03-15 09:04'::timestamptz),
      (5, 'Apple ID created', 'Apple ID', '2026-03-15 09:05'::timestamptz)
  ) as t(seq, label, service, item_timestamp)
)
insert into public.provisioning_items (
  employee_id,
  label,
  completed,
  service,
  item_timestamp
)
select
  e.id,
  it.label,
  case
    when e.id = 'emp-008' then it.seq <= 3
    when e.id = 'emp-009' then it.seq <= 2
    else true
  end as completed,
  it.service,
  it.item_timestamp
from public.employees e
cross join item_template it;

insert into public.provisioning_jobs (
  id,
  employee_id,
  service,
  status,
  triggered_at,
  completed_at
)
values
  ('pj-001', 'emp-009', 'M365', 'Running', '2026-03-18 09:00', null),
  ('pj-002', 'emp-009', 'Apple ID', 'Queued', '2026-03-18 09:00', null),
  ('pj-003', 'emp-008', 'M365', 'Completed', '2026-03-10 09:00', '2026-03-10 09:05'),
  ('pj-004', 'emp-008', 'Apple ID', 'Failed', '2026-03-10 09:00', null),
  ('pj-005', 'emp-007', 'M365', 'Completed', '2026-03-01 09:00', '2026-03-01 09:04'),
  ('pj-006', 'emp-007', 'Apple ID', 'Completed', '2026-03-01 09:00', '2026-03-01 09:03');

insert into public.provisioning_job_logs (
  job_id,
  step,
  log_timestamp,
  status
)
values
  ('pj-001', 'Creating M365 account', '2026-03-18 09:00:01', 'done'),
  ('pj-001', 'Assigning Business Premium licence', '2026-03-18 09:00:15', 'done'),
  ('pj-001', 'Configuring email mila@cores.nl', '2026-03-18 09:00:30', 'pending'),
  ('pj-001', 'Adding to shared mailboxes', null, 'pending'),
  ('pj-001', 'Adding to SharePoint group', null, 'pending'),
  ('pj-002', 'Creating Apple Business Manager account', null, 'pending'),
  ('pj-003', 'Creating M365 account', '2026-03-10 09:00:01', 'done'),
  ('pj-003', 'Assigning Business Premium licence', '2026-03-10 09:00:15', 'done'),
  ('pj-003', 'Configuring email niels@cores.nl', '2026-03-10 09:00:30', 'done'),
  ('pj-003', 'Adding to shared mailboxes', '2026-03-10 09:01:00', 'done'),
  ('pj-003', 'Adding to SharePoint group', '2026-03-10 09:01:30', 'done'),
  ('pj-004', 'Creating Apple Business Manager account', '2026-03-10 09:02:00', 'error'),
  ('pj-005', 'Creating M365 account', '2026-03-01 09:00:01', 'done'),
  ('pj-005', 'Assigning Business Premium licence', '2026-03-01 09:00:15', 'done'),
  ('pj-005', 'Configuring email fleur@cores.nl', '2026-03-01 09:00:30', 'done'),
  ('pj-005', 'Adding to shared mailboxes', '2026-03-01 09:01:00', 'done'),
  ('pj-005', 'Adding to SharePoint group', '2026-03-01 09:01:30', 'done'),
  ('pj-006', 'Creating Apple Business Manager account', '2026-03-01 09:02:00', 'done');

insert into public.leave_balances (
  user_id,
  total_annual_days,
  used_days,
  pending_days,
  remaining_days
)
values
  ('emp-001', 25, 8, 5, 12),
  ('emp-002', 25, 5, 0, 20),
  ('emp-003', 25, 12, 5, 8),
  ('emp-004', 25, 3, 0, 22),
  ('emp-005', 25, 7, 2, 16),
  ('emp-006', 25, 10, 0, 15),
  ('emp-007', 15, 0, 0, 15),
  ('emp-008', 25, 0, 5, 20),
  ('emp-009', 25, 0, 0, 25),
  ('emp-010', 25, 20, 0, 5);

insert into public.leave_requests (
  id,
  user_id,
  leave_type,
  start_date,
  end_date,
  substitute_user_id,
  status,
  created_at,
  days
)
values
  ('lr-001', 'emp-001', 'Vacation', '2026-04-14', '2026-04-18', 'emp-004', 'Pending', '2026-03-20', 5),
  ('lr-002', 'emp-003', 'Vacation', '2026-04-07', '2026-04-11', null, 'Pending', '2026-03-18', 5),
  ('lr-003', 'emp-005', 'Sick', '2026-03-24', '2026-03-25', null, 'Pending', '2026-03-24', 2),
  ('lr-004', 'emp-008', 'Vacation', '2026-05-05', '2026-05-09', 'emp-006', 'Pending', '2026-03-22', 5),
  ('lr-005', 'emp-001', 'Vacation', '2026-01-06', '2026-01-10', null, 'Approved', '2025-12-15', 5),
  ('lr-006', 'emp-001', 'Sick', '2026-02-17', '2026-02-19', null, 'Approved', '2026-02-17', 3),
  ('lr-007', 'emp-002', 'Vacation', '2026-02-24', '2026-02-28', null, 'Approved', '2026-02-01', 5),
  ('lr-008', 'emp-003', 'Parental', '2026-01-13', '2026-01-24', null, 'Approved', '2025-12-20', 10),
  ('lr-009', 'emp-003', 'Sick', '2026-03-10', '2026-03-11', null, 'Approved', '2026-03-10', 2),
  ('lr-010', 'emp-006', 'Vacation', '2026-03-03', '2026-03-14', null, 'Approved', '2026-02-15', 10),
  ('lr-011', 'emp-004', 'Vacation', '2026-02-10', '2026-02-12', null, 'Approved', '2026-01-20', 3),
  ('lr-012', 'emp-005', 'Vacation', '2026-01-20', '2026-01-24', null, 'Approved', '2026-01-05', 5),
  ('lr-013', 'emp-005', 'Sick', '2026-03-03', '2026-03-04', null, 'Rejected', '2026-03-03', 2);

insert into public.notifications (
  user_id,
  title,
  description,
  type,
  is_read,
  link,
  payload,
  created_at
)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Leave request awaiting approval',
    'Sophie de Vries submitted a vacation request for 5 days.',
    'info',
    false,
    '/absence',
    '{"requestId":"lr-001"}'::jsonb,
    '2026-03-27 09:18:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Provisioning completed',
    'M365 provisioning for Fleur Hendriks finished successfully.',
    'success',
    false,
    '/provisioning',
    '{"jobId":"pj-005"}'::jsonb,
    '2026-03-27 08:51:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Apple ID job failed',
    'Apple ID provisioning failed for Niels de Groot. Review job logs.',
    'error',
    false,
    '/provisioning',
    '{"jobId":"pj-004"}'::jsonb,
    '2026-03-27 07:43:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'New onboarding started',
    'Mila Smit joined onboarding and has pending setup steps.',
    'info',
    true,
    '/onboarding',
    '{"employeeId":"emp-009"}'::jsonb,
    '2026-03-26 16:25:00+00'
  );

commit;
