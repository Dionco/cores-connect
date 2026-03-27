-- Notifications table for in-app notification center

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  title text not null,
  description text not null,
  type text not null,
  is_read boolean not null default false,
  link text,
  payload jsonb,
  constraint notifications_type_check check (type in ('info', 'success', 'warning', 'error'))
);

create index if not exists idx_notifications_user_created_at
  on public.notifications(user_id, created_at desc);

create index if not exists idx_notifications_user_read_created_at
  on public.notifications(user_id, is_read, created_at desc);

create index if not exists idx_notifications_unread_partial
  on public.notifications(user_id, created_at desc)
  where is_read = false;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (auth.uid()::text = user_id or (select public.is_admin()));

drop policy if exists notifications_insert_admin on public.notifications;
create policy notifications_insert_admin
  on public.notifications
  for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (auth.uid()::text = user_id or (select public.is_admin()))
  with check (auth.uid()::text = user_id or (select public.is_admin()));

drop policy if exists notifications_delete_admin on public.notifications;
create policy notifications_delete_admin
  on public.notifications
  for delete
  to authenticated
  using ((select public.is_admin()));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
