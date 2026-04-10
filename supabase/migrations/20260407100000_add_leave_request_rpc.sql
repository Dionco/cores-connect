-- Transactional leave operations for client RPC usage.
-- These functions centralize authorization and keep leave balance updates atomic.

create or replace function public.auth_email()
returns text
language sql
stable
as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), ''));
$$;

create or replace function public.can_manage_leave_for(target_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.is_admin())
    or exists (
      select 1
      from public.employees e
      where e.id = target_user_id
        and lower(e.email) = (select public.auth_email())
    );
$$;

create or replace function public.submit_leave_request(
  p_user_id text,
  p_leave_type text,
  p_start_date date,
  p_end_date date,
  p_substitute_user_id text default null,
  p_days integer default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  balance_row public.leave_balances%rowtype;
  effective_days integer;
  request_id text;
begin
  if not (select public.can_manage_leave_for(p_user_id)) then
    raise exception 'You are not authorized to submit leave for this user.'
      using errcode = '42501';
  end if;

  if p_end_date < p_start_date then
    raise exception 'End date must be on or after start date.'
      using errcode = '22023';
  end if;

  effective_days := coalesce(p_days, 0);
  if effective_days <= 0 then
    raise exception 'Leave request must include at least one business day.'
      using errcode = '22023';
  end if;

  select *
  into balance_row
  from public.leave_balances
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Leave balance not found for user %.', p_user_id
      using errcode = '22023';
  end if;

  if balance_row.remaining_days < effective_days then
    raise exception 'Insufficient remaining leave balance.'
      using errcode = '22023';
  end if;

  request_id := 'lr-' || replace(gen_random_uuid()::text, '-', '');

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
  values (
    request_id,
    p_user_id,
    p_leave_type,
    p_start_date,
    p_end_date,
    p_substitute_user_id,
    'Pending',
    timezone('utc', now()),
    effective_days
  );

  update public.leave_balances
  set
    pending_days = pending_days + effective_days,
    remaining_days = remaining_days - effective_days
  where user_id = p_user_id;

  return request_id;
end;
$$;

create or replace function public.approve_leave_request(
  p_request_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.leave_requests%rowtype;
  balance_row public.leave_balances%rowtype;
begin
  if not (select public.is_admin()) then
    raise exception 'Only HR/Admin users can approve leave requests.'
      using errcode = '42501';
  end if;

  select *
  into request_row
  from public.leave_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Leave request % was not found.', p_request_id
      using errcode = '22023';
  end if;

  if request_row.status <> 'Pending' then
    raise exception 'Only pending leave requests can be approved.'
      using errcode = '22023';
  end if;

  select *
  into balance_row
  from public.leave_balances
  where user_id = request_row.user_id
  for update;

  if not found then
    raise exception 'Leave balance not found for user %.', request_row.user_id
      using errcode = '22023';
  end if;

  if balance_row.pending_days < request_row.days then
    raise exception 'Leave balance is inconsistent for user %.', request_row.user_id
      using errcode = '22023';
  end if;

  update public.leave_requests
  set status = 'Approved'
  where id = request_row.id;

  update public.leave_balances
  set
    pending_days = pending_days - request_row.days,
    used_days = used_days + request_row.days
  where user_id = request_row.user_id;
end;
$$;

create or replace function public.reject_leave_request(
  p_request_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.leave_requests%rowtype;
  balance_row public.leave_balances%rowtype;
begin
  if not (select public.is_admin()) then
    raise exception 'Only HR/Admin users can reject leave requests.'
      using errcode = '42501';
  end if;

  select *
  into request_row
  from public.leave_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Leave request % was not found.', p_request_id
      using errcode = '22023';
  end if;

  if request_row.status <> 'Pending' then
    raise exception 'Only pending leave requests can be rejected.'
      using errcode = '22023';
  end if;

  select *
  into balance_row
  from public.leave_balances
  where user_id = request_row.user_id
  for update;

  if not found then
    raise exception 'Leave balance not found for user %.', request_row.user_id
      using errcode = '22023';
  end if;

  if balance_row.pending_days < request_row.days then
    raise exception 'Leave balance is inconsistent for user %.', request_row.user_id
      using errcode = '22023';
  end if;

  update public.leave_requests
  set status = 'Rejected'
  where id = request_row.id;

  update public.leave_balances
  set
    pending_days = pending_days - request_row.days,
    remaining_days = remaining_days + request_row.days
  where user_id = request_row.user_id;
end;
$$;

revoke all on function public.submit_leave_request(text, text, date, date, text, integer) from public;
revoke all on function public.approve_leave_request(text) from public;
revoke all on function public.reject_leave_request(text) from public;

grant execute on function public.submit_leave_request(text, text, date, date, text, integer) to authenticated;
grant execute on function public.approve_leave_request(text) to authenticated;
grant execute on function public.reject_leave_request(text) to authenticated;
