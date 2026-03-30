# Add Employee Workflow — Design Spec

**Date:** 2026-03-30
**Status:** Approved

## Overview

Replace the existing single-page `AddEmployeeDialog` with a 4-step wizard that guides the admin through creating an employee record, selecting shared mailboxes, selecting security groups, and reviewing before synchronously provisioning the Microsoft 365 account.

---

## Goals

- Multi-step wizard UI with progress bar and stepper navigation
- Live shared mailbox and security group lists fetched from Microsoft Graph
- Admin manually selects which mailboxes and groups to assign (no auto-assignment by department)
- Synchronous provisioning — spinner while waiting, inline error with retry on failure
- In-dialog success screen on completion

---

## Frontend — `AddEmployeeDialog.tsx`

### Dialog state

| Field | Type | Description |
|---|---|---|
| `currentStep` | `1 \| 2 \| 3 \| 4` | Active wizard step |
| `view` | `'wizard' \| 'success' \| 'error'` | Top-level dialog view |
| `form fields` | strings / Date | All current fields retained (see below) |
| `workEmail` | `string` | Auto-derived, editable |
| `selectedMailboxes` | `string[]` | Email addresses of selected shared mailboxes |
| `selectedGroupIds` | `string[]` | Graph group IDs of selected security groups |
| `availableMailboxes` | `{email, displayName}[]` | Fetched from `graph-resources` on dialog open |
| `availableGroups` | `{id, displayName}[]` | Fetched from `graph-resources` on dialog open |
| `isCreating` | `boolean` | Drives spinner on Review step |
| `errorMessage` | `string \| null` | Inline error shown in Review step |

### Form fields (Step 1)

All current fields are kept:
- First name, last name (required)
- Work email — auto-derives as `{firstInitial}{lastName}@cores.nl` on keystroke, editable override. This value is passed as `employee.email` to the provisioning provider, which uses it as the Microsoft 365 UPN.
- Personal email
- Role / job title (required)
- Department (required, Select)
- Start date (date picker)
- Contract type (Select)
- Work phone, personal phone

Validation on Next: firstName, lastName, role, department are required.

### Step 2 — Shared Mailboxes

- Checkbox list rendered from `availableMailboxes`
- Skeleton/spinner while loading; inline retry on fetch error
- No required validation — zero selections is valid

### Step 3 — Security Groups

- Same pattern as Step 2 from `availableGroups`
- Each item shows display name
- No required validation

### Step 4 — Review & Create

- Summary of all employee details, selected mailboxes (or "None"), selected groups (or "None")
- "Create Account" button triggers synchronous provisioning call
- During creation: spinner replaces button, all navigation disabled
- On error: inline error message below summary + "Try Again" re-submits without resetting steps
- On success: transitions to success screen

### Success screen

- Replaces dialog content (stepper hidden)
- Shows new account work email + summary of what was assigned
- Single "Done" button closes and resets the dialog

---

## Backend — New `graph-resources` Edge Function

**Path:** `supabase/functions/graph-resources/index.ts`

Called once when the dialog opens. Returns available shared mailboxes and security groups.

### Response shape

```ts
{
  sharedMailboxes: { email: string; displayName: string }[]
  securityGroups:  { id: string;    displayName: string }[]
}
```

### Implementation

- **Security groups:** reuses existing `listSecurityGroups()` from `_shared/providers/microsoft.ts`
- **Shared mailboxes:** new `listSharedMailboxes()` function added to `_shared/providers/microsoft.ts`, queries Graph API filtering on `recipientTypeDetails eq 'SharedMailbox'`
- Uses Graph token only (no EXO token needed for listing)
- Uses existing `getAccessToken` + `getConfig` helpers

---

## Backend — Changes to `types.ts`

Add `ProvisioningOptions`:

```ts
export interface ProvisioningOptions {
  selectedMailboxes?: string[]  // email addresses
  selectedGroupIds?: string[]   // Graph group IDs
}
```

Update `ProvisioningProvider`:

```ts
export interface ProvisioningProvider {
  service: AutomationService;
  workflowName: string;
  run: (employee: EmployeeRow, options?: ProvisioningOptions) => Promise<ProvisioningStep[]>;
}
```

---

## Backend — Changes to `onboarding-trigger`

Accept `selectedMailboxes` and `selectedGroupIds` in the request body and pass them as `options` to `provider.run()`.

---

## Backend — Changes to `microsoftProvider`

- `run()` accepts optional `ProvisioningOptions` as second argument
- When `options.selectedMailboxes` is provided → use those instead of the current hardcoded department-based mailbox logic
- When `options.selectedGroupIds` is provided → use those instead of `MS_GRAPH_SECURITY_GROUP_IDS` env var logic
- When options are absent → existing env-var fallback behaviour is preserved (backwards compatible)

---

## Data flow

```
Dialog opens
  → fetch graph-resources (mailboxes + groups)
  → populate Steps 2 & 3

Admin fills Steps 1–3, reaches Step 4

Admin clicks "Create Account"
  → POST onboarding-trigger { employee, selectedMailboxes, selectedGroupIds }
  → spinner shown, navigation disabled
  → on success → success screen
  → on error   → inline error + "Try Again"
```

---

## Out of scope

- Automatic department-based mailbox assignment (replaced by manual selection)
- Async/background provisioning job flow for this dialog
- Editing provisioning selections after account creation
