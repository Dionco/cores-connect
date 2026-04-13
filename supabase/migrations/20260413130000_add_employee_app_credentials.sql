-- Encrypted per-employee app credentials (Slite, Tribe CRM, Apple ID, etc.)
-- Passwords are encrypted at-rest with pgcrypto using a key stored in Supabase Vault.
-- Plaintext is only ever returned through a SECURITY DEFINER RPC that audits every reveal.

create extension if not exists pgcrypto;

-- Vault-backed encryption key. Created once; rotate by inserting a new secret and
-- updating the resolve_app_credentials_key() function below.
do $$
declare
  v_key text;
begin
  if not exists (select 1 from vault.secrets where name = 'app_credentials_key') then
    -- 32-byte random key, base64 — strong enough for symmetric encryption.
    v_key := encode(extensions.gen_random_bytes(32), 'base64');
    perform vault.create_secret(v_key, 'app_credentials_key', 'Symmetric key for employee_app_credentials.password_encrypted');
  end if;
end $$;

create or replace function public.resolve_app_credentials_key()
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'app_credentials_key'
  limit 1;
$$;

revoke all on function public.resolve_app_credentials_key() from public, anon, authenticated;

create table if not exists public.employee_app_credentials (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.employees(id) on delete cascade,
  app_name text not null,
  login_url text,
  username text,
  notes text,
  password_encrypted bytea,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employee_app_credentials_app_name_check check (length(btrim(app_name)) > 0)
);

create index if not exists idx_employee_app_credentials_employee
  on public.employee_app_credentials(employee_id, app_name);

alter table public.employee_app_credentials enable row level security;

drop policy if exists employee_app_credentials_select on public.employee_app_credentials;
create policy employee_app_credentials_select
  on public.employee_app_credentials
  for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists employee_app_credentials_insert on public.employee_app_credentials;
create policy employee_app_credentials_insert
  on public.employee_app_credentials
  for insert
  to authenticated
  with check ((select public.is_admin()));

drop policy if exists employee_app_credentials_update on public.employee_app_credentials;
create policy employee_app_credentials_update
  on public.employee_app_credentials
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists employee_app_credentials_delete on public.employee_app_credentials;
create policy employee_app_credentials_delete
  on public.employee_app_credentials
  for delete
  to authenticated
  using ((select public.is_admin()));

-- Audit log: append-only, admin-readable.
create table if not exists public.app_credential_access_log (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid references public.employee_app_credentials(id) on delete set null,
  employee_id text,
  app_name text,
  accessed_by uuid references auth.users(id) on delete set null,
  action text not null check (action in ('reveal', 'create', 'update', 'delete')),
  accessed_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_credential_access_log_credential
  on public.app_credential_access_log(credential_id, accessed_at desc);
create index if not exists idx_app_credential_access_log_employee
  on public.app_credential_access_log(employee_id, accessed_at desc);

alter table public.app_credential_access_log enable row level security;

drop policy if exists app_credential_access_log_select on public.app_credential_access_log;
create policy app_credential_access_log_select
  on public.app_credential_access_log
  for select
  to authenticated
  using ((select public.is_admin()));

-- No insert/update/delete policies for clients — only the SECURITY DEFINER RPCs write here.

-- ---------- RPCs ----------

create or replace function public.set_app_credential_password(
  cred_id uuid,
  plaintext text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id text;
  v_app_name text;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  if plaintext is null or length(plaintext) = 0 then
    raise exception 'password must not be empty';
  end if;

  update public.employee_app_credentials
  set password_encrypted = extensions.pgp_sym_encrypt(plaintext, public.resolve_app_credentials_key()),
      updated_at = timezone('utc', now())
  where id = cred_id
  returning employee_id, app_name into v_employee_id, v_app_name;

  if not found then
    raise exception 'credential not found';
  end if;

  insert into public.app_credential_access_log (credential_id, employee_id, app_name, accessed_by, action)
  values (cred_id, v_employee_id, v_app_name, auth.uid(), 'update');
end;
$$;

revoke all on function public.set_app_credential_password(uuid, text) from public, anon;
grant execute on function public.set_app_credential_password(uuid, text) to authenticated;

create or replace function public.reveal_app_credential_password(cred_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_password text;
  v_employee_id text;
  v_app_name text;
  v_encrypted bytea;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select password_encrypted, employee_id, app_name
    into v_encrypted, v_employee_id, v_app_name
  from public.employee_app_credentials
  where id = cred_id;

  if v_encrypted is null then
    return null;
  end if;

  v_password := extensions.pgp_sym_decrypt(v_encrypted, public.resolve_app_credentials_key());

  insert into public.app_credential_access_log (credential_id, employee_id, app_name, accessed_by, action)
  values (cred_id, v_employee_id, v_app_name, auth.uid(), 'reveal');

  return v_password;
end;
$$;

revoke all on function public.reveal_app_credential_password(uuid) from public, anon;
grant execute on function public.reveal_app_credential_password(uuid) to authenticated;
