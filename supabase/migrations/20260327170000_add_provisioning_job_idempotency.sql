-- Add idempotency and retry metadata for provisioning orchestration.

alter table public.provisioning_jobs
  add column if not exists idempotency_key text,
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.provisioning_jobs
  drop constraint if exists provisioning_jobs_retry_count_non_negative;

alter table public.provisioning_jobs
  add constraint provisioning_jobs_retry_count_non_negative
  check (retry_count >= 0);

create unique index if not exists uq_provisioning_jobs_idempotency_active
  on public.provisioning_jobs(idempotency_key)
  where idempotency_key is not null and status <> 'Failed';

create index if not exists idx_provisioning_jobs_employee_service_triggered_at
  on public.provisioning_jobs(employee_id, service, triggered_at desc);
