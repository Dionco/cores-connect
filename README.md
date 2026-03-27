# Cores Connect

## Run Locally

1. Install dependencies:

```bash
bun install
```

2. Start the app:

```bash
bun run dev
```

## Connect Supabase

1. Create your env file from the example:

```bash
cp .env.example .env
```

2. Fill these values in `.env` from Supabase project settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_AUTH_REDIRECT_URL` (optional, defaults to current origin)

3. In Supabase dashboard, configure Auth settings:

- Add `http://localhost:8080` to allowed redirect URLs.
- Enable Email provider if you want email/password login.
- Enable Azure provider if you want "Sign in with Microsoft 365".

4. Create at least one auth user in Supabase Auth (Users) to test login.

5. Restart dev server after editing env:

```bash
bun run dev
```

## Notes

- If Supabase env variables are missing, the app falls back to mock auth mode.
- Legacy `VITE_SUPABASE_ANON_KEY` is still accepted as a fallback during migration.
- The current integration handles authentication/session only. Domain data is still mocked in `src/data/mockData.ts`.

## Microsoft Graph Provisioning Setup

The onboarding automation edge functions can now call Microsoft Graph for M365 provisioning.

1. Register an Entra ID app for backend automation.
2. Grant Graph application permissions and admin consent:
- `User.ReadWrite.All`
- `GroupMember.ReadWrite.All`
- `Directory.ReadWrite.All`
3. Create a client secret for the app registration.
4. Gather tenant and service configuration values:
- Tenant ID
- Client ID
- Client Secret
- Default domain (example: `contoso.onmicrosoft.com`)
- Business Premium SKU ID (optional but recommended)
- Group IDs for default and department-specific access (optional)

If shared mailbox access is already granted via your default all-users group, leave
the `MS_GRAPH_SHARED_MAILBOX_GROUP_*` secrets unset. The automation will still add new
users to `MS_GRAPH_DEFAULT_GROUP_ID` and skip mailbox-specific group assignments.

Set Supabase edge secrets (replace values):

```bash
supabase secrets set \
	MS_GRAPH_TENANT_ID="<tenant-id>" \
	MS_GRAPH_CLIENT_ID="<client-id>" \
	MS_GRAPH_CLIENT_SECRET="<client-secret>" \
	MS_GRAPH_DOMAIN="<tenant-domain>" \
	MS_GRAPH_USAGE_LOCATION="NL" \
	MS_GRAPH_BUSINESS_PREMIUM_SKU_ID="<sku-guid>" \
	MS_GRAPH_DEFAULT_GROUP_ID="<default-group-guid>" \
	MS_GRAPH_SHARED_MAILBOX_GROUP_TRADING="<trading-group-guid>" \
	MS_GRAPH_SHARED_MAILBOX_GROUP_SALES="<sales-group-guid>" \
	MS_GRAPH_SHARED_MAILBOX_GROUP_CUSTOMS="<customs-group-guid>" \
	MS_GRAPH_SHARED_MAILBOX_GROUP_TRANSPORT="<transport-group-guid>"
```

Optional secret:
- `MS_GRAPH_INITIAL_PASSWORD` to force a fixed initial password during account creation (if omitted, a random password is generated).

Deploy functions:

```bash
supabase functions deploy onboarding-trigger
supabase functions deploy provisioning-retry
supabase functions deploy graph-health-check
```

Validate Graph configuration before onboarding runs:

```bash
curl -sS -X POST "${VITE_SUPABASE_URL}/functions/v1/graph-health-check" \
	-H "apikey: ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
	-H "Authorization: Bearer ${VITE_SUPABASE_PUBLISHABLE_KEY}" \
	-H "Content-Type: application/json" \
	-d '{}'
```

Expected response:
- `ok: true`
- token check passes
- configured SKU check passes (or is explicitly skipped)
- configured group IDs are all found

Smoke test from app:
1. Open onboarding page and trigger `Start M365 automation`.
2. Confirm `provisioning_jobs` and `provisioning_job_logs` rows are created and updated.
3. If a job fails, trigger retry from provisioning page.
