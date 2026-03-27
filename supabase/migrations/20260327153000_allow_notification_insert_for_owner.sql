-- Allow authenticated users to create notifications for themselves.

alter table public.notifications enable row level security;

drop policy if exists notifications_insert_admin on public.notifications;
create policy notifications_insert_owner_or_admin
  on public.notifications
  for insert
  to authenticated
  with check (auth.uid()::text = user_id or (select public.is_admin()));
