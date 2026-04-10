# Onboarding Workflow — Implementation Plan

> Reference document for building the full employee onboarding flow in the Cores HR Portal.
> Based on the Employee Onboarding Workflow v2 specification.

---

## 1. Goals

Give the HR admin a single, guided view per employee that tracks every onboarding step from account creation to final verification. The admin should always be able to answer: **"What do I need to do right now, and what am I waiting on?"**

Key principles:

- Phases unlock based on dependencies, not strict linear order.
- Every task knows its assignee (Admin, Employee, Horizon3) so the admin sees what's theirs vs. what's blocked on someone else.
- Conditional tasks (Transportplan) appear only when relevant.
- Instructions are embedded per task — no hunting for external guides.
- The existing Cores M365 automation (`triggerOnboardingAutomation`) integrates seamlessly; the onboarding reflects provisioning state rather than duplicating it.

---

## 2. Two Microsoft accounts — the core distinction

Every employee ends up with **two** separate Microsoft 365 accounts:

| Account | Provisioned by | Method | Where in workflow |
|---------|---------------|--------|-------------------|
| **Cores M365** | Internal Admin | Automated via `triggerOnboardingAutomation()` + Graph API Edge Functions, or manual | Phase 3 (Internal Accounts) |
| **Horizon3 M365** | Horizon3 Admin | Fully manual — email request, wait for credentials | Phase 2 (Horizon3 Requests) |

The Cores account may already exist when onboarding starts (if the admin chose "Create + Provision" in AddEmployeeDialog). The Horizon3 account is always a manual external request.

Phase 4 (Employee Setup) depends on **both** accounts being ready — Outlook Profile 1 uses Cores, Profile 2 uses Horizon3.

---

## 3. Data model

### 3.1 Template (constant, shared across all employees)

```typescript
// src/data/onboardingTemplate.ts

type TaskAssignee = 'admin' | 'employee' | 'horizon3' | 'transportplan_admin';

type TaskCondition = {
  field: 'department';
  values: string[]; // employee must be in one of these departments
};

type TaskInstruction = {
  steps: string[];                          // i18n keys, rendered as ordered list
  links?: { label: string; url: string }[]; // external documentation links
  notes?: string;                           // i18n key, rendered as info callout
};

type OnboardingTaskTemplate = {
  id: string;               // e.g. 'request-horizon3-m365'
  phaseId: string;           // references OnboardingPhaseTemplate.id
  title: string;             // i18n key
  description: string;       // i18n key
  assignee: TaskAssignee;
  order: number;             // sort order within phase
  condition?: TaskCondition; // if set, task only appears when condition is met
  instructions?: TaskInstruction;
  automatable?: boolean;     // true = can be triggered via existing automation
  actionType?: 'generate_email' | 'trigger_provisioning' | 'retry_provisioning';
};

type OnboardingPhaseTemplate = {
  id: string;
  title: string;        // i18n key
  description: string;  // i18n key
  order: number;        // display order (1-9)
  dependsOn: string[];  // phase IDs that must be completed before this unlocks
};
```

### 3.2 Instance (per employee, mutable)

```typescript
// Added to src/data/mockData.ts

type OnboardingTaskStatus =
  | 'pending'            // not started
  | 'in_progress'        // admin is actively working on it
  | 'waiting_external'   // request sent to Horizon3, waiting for response
  | 'completed'          // done
  | 'skipped';           // conditional task that doesn't apply

type OnboardingTaskInstance = {
  taskTemplateId: string;     // references OnboardingTaskTemplate.id
  status: OnboardingTaskStatus;
  completedAt?: string;       // ISO datetime
  completedBy?: string;       // who marked it done
  notes?: string;             // admin can add notes (e.g. "credentials received via email")
};

type OnboardingPhaseStatus =
  | 'locked'        // dependencies not met
  | 'available'     // unlocked, has pending tasks
  | 'in_progress'   // at least one task started
  | 'waiting'       // all admin tasks done, waiting on external/employee
  | 'completed';    // all tasks done

type OnboardingWorkflowStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed';

type OnboardingWorkflow = {
  id: string;
  employeeId: string;
  status: OnboardingWorkflowStatus;
  tasks: OnboardingTaskInstance[];
  createdAt: string;  // ISO datetime
  updatedAt: string;  // ISO datetime
};
```

### 3.3 Computed state (derived at read time, not stored)

The hook computes these from the workflow + template:

- **Phase status**: locked / available / in_progress / waiting / completed — derived from dependency graph + task statuses within the phase.
- **Phase progress**: `{ completed: number, total: number }` — count of completed tasks vs total applicable tasks.
- **Overall progress**: percentage across all non-skipped tasks.
- **Next actions**: list of tasks the admin can act on right now (pending tasks in unlocked phases where assignee is 'admin').

---

## 4. Phase definitions and dependency graph

```
Phase 1 (auto-completed on employee creation)
    ├──→ Phase 2 (Horizon3 requests)  ──→ Phase 4 (Employee setup)  ──→ Phase 5 (Transportplan, conditional)
    ├──→ Phase 3 (Internal accounts)  ──→ Phase 6 (System activation)
    └──→ Phase 7 (Instructions delivery — can start once Phase 1 is done)
                                           All of 4,5,6,7 ──→ Phase 8 (Verification) ──→ Phase 9 (Completion)
```

Note: Phase 4 depends on **both** Phase 2 **and** Phase 3, because Outlook setup needs both Cores and Horizon3 accounts.

| Phase | ID | Title | Depends on | Description |
|-------|----|-------|------------|-------------|
| 1 | `employee-creation` | Employee creation | — | Collect employee data. Auto-completed via AddEmployeeDialog. |
| 2 | `horizon3-requests` | Horizon3 admin requests | Phase 1 | Request Horizon3 M365 + CIMS accounts (manual, external). |
| 3 | `internal-accounts` | Internal account creation | Phase 1 | Create Tribe CRM, Slite, Transportplan, Apple Business Manager, and Cores M365 accounts. |
| 4 | `employee-setup` | Employee setup | Phase 2 + Phase 3 | Admin sets up accounts using temporary password, configures Outlook (both profiles), syncs SharePoint. |
| 5 | `transportplan-setup` | Transportplan setup | Phase 4 | Install Windows App, login to Transportplan Cloud. Conditional on department. |
| 6 | `system-activation` | System activation | Phase 3 | Employee logs into Tribe CRM, CIMS, Slite for the first time. |
| 7 | `instructions-delivery` | Instructions delivery | Phase 1 | Admin provides onboarding documentation package to employee. |
| 8 | `verification` | Final verification | Phase 4 + Phase 5 + Phase 6 + Phase 7 | Admin checklist — verify all systems work. |
| 9 | `completion` | Completion | Phase 8 | Mark onboarding complete, close workflow. |

---

## 5. Task definitions (all 35 tasks)

### Phase 1 — Employee creation

| # | Task ID | Title | Assignee | Notes |
|---|---------|-------|----------|-------|
| 1 | `collect-employee-info` | Collect employee information | admin | Auto-completed when employee is created via AddEmployeeDialog. Stores: name, title, department, start date, email, required apps, device type. |

### Phase 2 — Horizon3 admin requests

| # | Task ID | Title | Assignee | Notes |
|---|---------|-------|----------|-------|
| 2 | `request-horizon3-m365` | Request Horizon3 Microsoft 365 account | horizon3 | Admin sends email to Horizon3. Action: "Generate request email" button. Status goes to `waiting_external`. Includes shared mailbox requests (invoices@, operations@) and SharePoint access. |
| 3 | `request-horizon3-cims` | Request CIMS account | horizon3 | Same pattern — email request, wait for credentials. |

### Phase 3 — Internal account creation

| # | Task ID | Title | Assignee | Notes |
|---|---------|-------|----------|-------|
| 4 | `provision-cores-m365` | Cores Microsoft 365 account | admin | If provisioning was triggered during employee creation, this task auto-initializes as `completed` or `in_progress` based on provisioning job status. If not, shows "Trigger provisioning" button calling `triggerOnboardingAutomation()`. Also handles shared mailbox assignment. |
| 5 | `create-tribe-crm` | Create Tribe CRM account | admin | Steps: create user, assign role/permissions, add license, add to teams, assign dashboards. |
| 6 | `create-slite` | Create Slite account | admin | Steps: create user, add to workspace, assign role, add to onboarding docs + teams. |
| 7 | `request-transportplan` | Request Transportplan account | transportplan_admin | **Conditional**: only for departments Transport, Operations, Planning, Logistics. Same external request pattern as Horizon3: admin sends email to Transportplan software admin, status goes to `waiting_external`, admin confirms when credentials are received. Action: "Generate request email" button. |
| 8 | `create-apple-business-manager` | Create Apple Business Manager account | admin | Steps: create account using Cores email, assign organization + role. |

### Phase 4 — Employee setup (performed by admin)

The HR admin sets up the employee's accounts by logging into them using a temporary password obtained from M365. The admin configures Outlook, SharePoint, and signatures on behalf of the employee before handing over the device.

| # | Task ID | Title | Assignee | Notes |
|---|---------|-------|----------|-------|
| 9 | `obtain-temp-password-horizon3` | Obtain temporary password for Horizon3 account | admin | Admin resets or obtains a temp password from the Horizon3 M365 admin portal to log into the employee's Horizon3 account. This is needed before configuring Outlook and SharePoint. |
| 10 | `obtain-temp-password-cores` | Obtain temporary password for Cores account | admin | Admin resets or obtains a temp password from the Cores M365 admin portal (or uses the one from provisioning) to log into the employee's Cores account. |
| 11 | `activate-horizon3-m365` | Activate Horizon3 Microsoft account | admin | Admin logs in with temp password, changes password, enables MFA, opens Outlook/SharePoint/OneDrive. |
| 12 | `setup-sharepoint-sync` | Setup SharePoint synchronization | admin | Steps: open SharePoint, select libraries, click Sync, confirm in OneDrive, verify folders on Mac. |
| 13 | `setup-outlook-cores` | Setup Outlook — Cores profile | admin | Steps: add Cores Microsoft account using temp password, configure Outlook, add email signature. |
| 14 | `setup-outlook-horizon3` | Setup Outlook — Horizon3 profile | admin | Steps: add Horizon3 account, add shared mailboxes (invoices@, operations@), configure. |
| 15 | `setup-shared-mailboxes` | Setup shared mailboxes | admin | Steps: open Outlook, add shared mailboxes, verify access, test sending. |
| 16 | `setup-email-signature` | Setup email signature | admin | Admin provides .htm signature file, imports into Outlook, sets defaults for new emails and replies, verifies formatting. |

### Phase 5 — Transportplan setup (conditional)

**Condition**: entire phase only appears for departments: Transport, Operations, Planning, Logistics.

| # | Task ID | Title | Assignee | Notes |
|---|---------|-------|----------|-------|
| 17 | `install-windows-app` | Install Windows App on Mac | employee | Steps: Mac App Store → search "Windows App" → install → login with Microsoft account → connect to company environment. |
| 18 | `login-transportplan-cloud` | Login to Transportplan Cloud | employee | Steps: open Windows App, start Transportplan Cloud, login with provided credentials, verify environment + permissions. |

### Phase 6 — System activation

| # | Task ID | Title | Assignee | Notes |
|---|---------|-------|----------|-------|
| 19 | `activate-cims` | Activate CIMS | employee | Steps: login, change password, verify access. |
| 20 | `activate-tribe-crm` | Activate Tribe CRM | employee | Steps: login, change password, check dashboards, verify permissions. |
| 21 | `activate-slite` | Activate Slite | employee | Steps: login, open onboarding docs, read company info, join teams. |

### Phase 7 — Instructions delivery

| # | Task ID | Title | Assignee | Notes |
|---|---------|-------|----------|-------|
| 22 | `deliver-onboarding-docs` | Provide onboarding documentation | admin | Deliver package including: SharePoint sync guide, Outlook profile setup, shared mailbox setup, email signature setup, Tribe CRM guide, Slite guide, Transportplan guide, Windows App installation, CIMS login instructions. |

### Phase 8 — Final verification

Static admin checklist matching the workflow document. The admin verifies each system works for the new employee.

| # | Task ID | Title | Assignee | Notes |
|---|---------|-------|----------|-------|
| 23 | `verify-horizon3-m365` | Verify Horizon3 Microsoft works | admin | |
| 24 | `verify-sharepoint-sync` | Verify SharePoint sync works | admin | |
| 25 | `verify-onedrive` | Verify OneDrive works | admin | |
| 26 | `verify-outlook` | Verify Outlook profiles work | admin | |
| 27 | `verify-shared-mailboxes` | Verify shared mailboxes work | admin | |
| 28 | `verify-tribe-crm` | Verify Tribe CRM works | admin | |
| 29 | `verify-cims` | Verify CIMS works | admin | |
| 30 | `verify-slite` | Verify Slite works | admin | |
| 31 | `verify-transportplan` | Verify Transportplan works | admin | **Conditional**: same department condition as Phase 5. |
| 32 | `verify-windows-app` | Verify Windows App works | admin | **Conditional**: same department condition as Phase 5. |
| 33 | `verify-apple-business-manager` | Verify Apple Business Manager works | admin | |
| 34 | `verify-email-signature` | Verify email signature correct | admin | |

### Phase 9 — Completion

| # | Task ID | Title | Assignee | Notes |
|---|---------|-------|----------|-------|
| 35 | `mark-complete` | Mark onboarding complete | admin | Confirm all tasks done, employee operational, close workflow. Triggers completion notification. |

---

## 6. Task status model

```
                ┌─────────────────────────────────────────┐
                │                                         │
  pending ──→ in_progress ──→ completed                   │
    │                            ↑                        │
    │         (Horizon3 tasks)   │                        │
    └──→ waiting_external ───────┘                        │
                                                          │
  (conditional tasks that don't apply)                    │
  pending ──→ skipped ────────────────────────────────────┘
```

Rules:
- Admin can toggle any task in an unlocked phase between `pending` ↔ `completed`.
- Horizon3 tasks go through `pending` → `waiting_external` → `completed`.
- The `in_progress` status is optional — useful for multi-step tasks but not enforced.
- When all non-skipped tasks in a phase are completed, the phase status becomes `completed`, which may unlock dependent phases.

---

## 7. Integration with existing systems

### 7.1 AddEmployeeDialog integration

When a new employee is created:

1. The employee record is saved as it currently works.
2. If the admin triggered Cores M365 provisioning, the provisioning job starts as it currently works.
3. **New**: `initializeOnboarding(employeeId, department)` is called.
   - Creates an `OnboardingWorkflow` from the template.
   - Filters out conditional tasks based on department.
   - Sets Phase 1 task (`collect-employee-info`) to `completed`.
   - Checks provisioning job status:
     - If provisioning was triggered → sets `provision-cores-m365` to `in_progress` or `completed`.
     - If not triggered → sets `provision-cores-m365` to `pending` (admin can trigger later from onboarding).
4. Portal navigates to employee detail page → onboarding tab.

### 7.2 Cores M365 provisioning sync

The `provision-cores-m365` task connects to the existing automation:

- **`triggerOnboardingAutomation()`**: Called when admin clicks "Trigger provisioning" on the task card (if not already triggered during employee creation).
- **`retryProvisioningAutomation()`**: Called when admin clicks "Retry" after a failed provisioning attempt.
- **Provisioning job status polling**: The onboarding hook should read the existing provisioning job state and reflect it in the task status. When the provisioning job completes, the task auto-updates to `completed`.

### 7.3 External request email generator

For external request tasks, a dialog generates a pre-filled email. Two templates:

**Horizon3 request** (tasks `request-horizon3-m365` and `request-horizon3-cims`):

```
To: [Horizon3 admin email]
Subject: New Employee Account Request — {employee name}

Dear Horizon3 Admin,

Please create the following accounts for our new employee:

Employee: {full name}
Email: {cores email}
Department: {department}
Start date: {start date}

Requested:
- Microsoft 365 account
- Shared mailboxes: invoices@, operations@
- SharePoint access enabled
- CIMS account with login credentials

Please send the login credentials to {admin email}.

Kind regards,
{admin name}
```

**Transportplan request** (task `request-transportplan`, conditional):

```
To: [Transportplan admin email]
Subject: New Employee Account Request — {employee name}

Dear Transportplan Admin,

Please create a Transportplan account for our new employee:

Employee: {full name}
Department: {department}
Start date: {start date}

Please provide login credentials and assign appropriate permissions.

Please send the login credentials to {admin email}.

Kind regards,
{admin name}
```

The admin can copy to clipboard or open in their mail client. After sending, they mark the task as `waiting_external`.

### 7.4 Notifications

Trigger notifications via `createAppNotification()` for:

- Phase completed: "Phase 3 (Internal accounts) completed for {employee name}"
- External credentials received (when admin marks any external task complete): "Credentials received for {employee name} — {dependent phase} is now unlocked"
- Onboarding complete: "{employee name} onboarding completed"

---

## 8. Component architecture

```
EmployeeDetailPage
  └── Tabs (existing tab component)
       ├── ... (existing tabs)
       └── OnboardingTab
            ├── OnboardingProgressHeader
            │    ├── Overall progress bar (e.g. "24/35 tasks — 69%")
            │    ├── Status badge (in progress / completed)
            │    └── Start date + elapsed time
            │
            └── OnboardingTimeline
                 ├── PhaseSection (×9, rendered from template)
                 │    ├── PhaseHeader
                 │    │    ├── Phase number + icon
                 │    │    ├── Phase title
                 │    │    ├── Progress indicator (e.g. "3/5")
                 │    │    ├── PhaseStatusBadge (locked / available / in progress / waiting / completed)
                 │    │    └── Expand/collapse chevron
                 │    │
                 │    └── TaskList (collapsible, expanded when phase is active)
                 │         └── TaskCard (×N per phase)
                 │              ├── Checkbox (disabled if phase is locked)
                 │              ├── Task title
                 │              ├── AssigneeBadge (Admin / Employee / Horizon3 / Transportplan Admin — colored)
                 │              ├── TaskStatusBadge (pending / waiting / completed)
                 │              ├── Notes field (collapsible)
                 │              ├── ActionButton (optional)
                 │              │    ├── "Generate request email" (Horizon3 + Transportplan tasks)
                 │              │    ├── "Trigger provisioning" (Cores M365 task)
                 │              │    └── "Retry provisioning" (Cores M365 on failure)
                 │              └── InstructionAccordion (optional, when task has instructions)
                 │                   ├── Ordered step list
                 │                   ├── External documentation links
                 │                   └── Info note callout
                 │
                 └── CompletionCard (shown when Phase 9 is done)
                      ├── Success message
                      ├── Completion date
                      └── Summary of all systems set up

ExternalRequestEmailDialog (standalone dialog, opened from TaskCard action)
  ├── Pre-filled email preview (template selected based on task type)
  ├── "Copy to clipboard" button
  ├── "Open in mail client" button (mailto: link)
  └── "Mark as sent" button (sets task to waiting_external)
```

### Component design notes

- **PhaseSection** uses the shadcn Collapsible or Accordion component. The currently active phase(s) auto-expand on load. Completed phases are collapsed with a green checkmark. Locked phases show a lock icon and muted styling.
- **TaskCard** follows the existing card/checkbox patterns in the app. The checkbox is the primary interaction — click to toggle completion. The assignee badge uses the StatusBadge color mapping pattern.
- **InstructionAccordion** is a nested collapsible inside TaskCard. Light background, ordered list of steps, optional links section at the bottom.
- **OnboardingTimeline** renders a vertical line connecting phases, with colored dots for each phase status (gray = locked, blue = available, amber = in progress/waiting, green = completed).

---

## 9. Hook design — `useOnboarding`

Following the `useLeaveManagement` pattern: dual mock/Supabase mode, React Query, mutations.

```typescript
// src/hooks/useOnboarding.ts

export const useOnboarding = (employeeId: string) => {
  // Queries
  const workflowQuery = useQuery({
    queryKey: ['onboarding', employeeId],
    queryFn: () => fetchWorkflow(employeeId),
  });

  // Computed state (derived from workflow + template)
  const phaseStatuses = computePhaseStatuses(workflowQuery.data);
  const unlockedPhases = computeUnlockedPhases(workflowQuery.data);
  const overallProgress = computeOverallProgress(workflowQuery.data);
  const nextActions = computeNextActions(workflowQuery.data);

  // Mutations
  const initializeMutation = useMutation(/* ... */);
  const toggleTaskMutation = useMutation(/* ... */);
  const setTaskStatusMutation = useMutation(/* ... */);
  const addTaskNoteMutation = useMutation(/* ... */);
  const completeOnboardingMutation = useMutation(/* ... */);

  return {
    workflow: workflowQuery.data,
    isLoading: workflowQuery.isLoading,
    phaseStatuses,
    unlockedPhases,
    overallProgress,
    nextActions,
    initializeOnboarding: initializeMutation.mutateAsync,
    toggleTask: toggleTaskMutation.mutateAsync,
    setTaskStatus: setTaskStatusMutation.mutateAsync,
    addTaskNote: addTaskNoteMutation.mutateAsync,
    completeOnboarding: completeOnboardingMutation.mutateAsync,
  };
};
```

### Mock storage

```
localStorage key: cores:onboarding:{employeeId}
Value: JSON-serialized OnboardingWorkflow
```

### Key function: `initializeOnboarding(employeeId, department, provisioningJobStatus?)`

1. Read the task template constant.
2. Filter: remove tasks where `condition` doesn't match the employee's department.
3. Filter: if Phase 5 condition doesn't match, remove all Phase 5 tasks.
4. Create `OnboardingTaskInstance` for each remaining task template, status = `pending`.
5. Set `collect-employee-info` to `completed`.
6. If `provisioningJobStatus` is provided:
   - `'completed'` → set `provision-cores-m365` to `completed`
   - `'running'` → set `provision-cores-m365` to `in_progress`
   - `'failed'` → set `provision-cores-m365` to `pending` with a note about the failure
   - `undefined` → leave as `pending`
7. Save the workflow.

### Key function: `computePhaseStatuses(workflow)`

For each phase template:
1. Check `dependsOn` — if any dependency phase is not `completed`, status = `locked`.
2. Get all tasks for this phase from the workflow.
3. If all tasks `completed` or `skipped` → phase is `completed`.
4. If any task is `waiting_external` and no tasks are `pending` → phase is `waiting`.
5. If any task is `in_progress` or `completed` (but not all done) → phase is `in_progress`.
6. Otherwise → phase is `available`.

---

## 10. i18n keys

All user-facing strings go through `useLanguage().t(key)`. Approximate count: ~180 new keys.

Categories:
- 9 phase titles + 9 phase descriptions (18 keys)
- 35 task titles + 35 task descriptions (70 keys)
- ~60 instruction step strings across all tasks
- ~15 UI labels (status badges, button labels, dialog text, progress labels)
- ~20 email template strings (Horizon3 + Transportplan request emails)

All keys need both `en` and `nl` translations in `LanguageContext.tsx`.

---

## 11. Files to create

| File | Purpose |
|------|---------|
| `src/data/onboardingTemplate.ts` | Phase definitions, task templates with instructions, conditions, actions. The single source of truth for the workflow structure. |
| `src/hooks/useOnboarding.ts` | State management hook. Dual mock/Supabase mode. Query + mutations. Computed phase statuses. |
| `src/components/onboarding/OnboardingTab.tsx` | Tab wrapper. Fetches workflow, renders progress header + timeline. |
| `src/components/onboarding/OnboardingTimeline.tsx` | Vertical timeline with phase sections. Renders connector line between phases. |
| `src/components/onboarding/PhaseSection.tsx` | Single phase: header + collapsible task list. Handles expand/collapse. |
| `src/components/onboarding/PhaseHeader.tsx` | Phase number, title, progress, status badge, lock icon, chevron. |
| `src/components/onboarding/TaskCard.tsx` | Single task row: checkbox, title, assignee badge, status, actions, instructions. |
| `src/components/onboarding/AssigneeBadge.tsx` | Colored badge: Admin (blue), Employee (green), Horizon3 (purple), Transportplan Admin (amber). |
| `src/components/onboarding/InstructionAccordion.tsx` | Expandable instruction panel per task. Ordered steps + links + notes. |
| `src/components/onboarding/ExternalRequestEmailDialog.tsx` | Email generator dialog for Horizon3 and Transportplan requests. Template selected by task type. |
| `src/components/onboarding/OnboardingProgressHeader.tsx` | Overall progress bar, status, elapsed time. |
| `src/components/onboarding/CompletionCard.tsx` | Success card shown when onboarding is fully complete. |

## 12. Files to modify

| File | Change |
|------|--------|
| `src/data/mockData.ts` | Add `OnboardingWorkflow`, `OnboardingTaskInstance`, and related types. Add mock workflow data for existing mock employees. |
| `src/contexts/LanguageContext.tsx` | Add ~120 EN/NL translation keys for phases, tasks, instructions, UI labels. |
| `src/App.tsx` or employee detail page | Add Onboarding tab to employee detail view. |
| `src/components/AddEmployeeDialog.tsx` | After employee creation, call `initializeOnboarding()` with department and provisioning job status. |

---

## 13. Build order

Each step produces something testable. Steps 1–5 deliver the core experience; steps 6–10 are enhancements.

### Step 1 — Types + template (no UI)
- Define all TypeScript types in `mockData.ts`.
- Create `onboardingTemplate.ts` with all 9 phases and 35 task templates.
- Include instructions content for every task.
- Add mock `OnboardingWorkflow` data for 1-2 existing mock employees (one mid-onboarding, one not started).
- **Test**: import and log the template, verify types compile.

### Step 2 — `useOnboarding` hook
- Implement the hook with mock localStorage storage.
- Core functions: `initializeOnboarding`, `toggleTask`, `setTaskStatus`, `addTaskNote`.
- Computed state: `computePhaseStatuses`, `computeUnlockedPhases`, `computeOverallProgress`.
- **Test**: unit tests for phase dependency computation and task filtering.

### Step 3 — Timeline + phases + task cards (core UI)
- Build `OnboardingTab`, `OnboardingTimeline`, `PhaseSection`, `PhaseHeader`, `TaskCard`.
- Wire to the hook with mock data.
- Admin can expand phases, check tasks, see progress update.
- Locked phases show lock icon and disabled state.
- **Test**: render with mock employee, toggle tasks, verify phase unlocking.

### Step 4 — Integrate into employee detail page
- Add "Onboarding" tab to the employee detail view.
- Wire AddEmployeeDialog to call `initializeOnboarding` on submit.
- Pass department and provisioning status.
- **Test**: create new employee → onboarding tab appears with correct initial state.

### Step 5 — Instruction accordions
- Build `InstructionAccordion` component.
- Add instruction content from the workflow document to all task templates.
- Render steps as ordered list, links as buttons/anchors, notes as callouts.
- **Test**: expand instructions on various tasks, verify content matches the workflow document.

### Step 6 — External request email dialogs
- Build `ExternalRequestEmailDialog` with pre-filled email templates for both Horizon3 and Transportplan requests.
- Add "Generate request email" action button on all external tasks (Horizon3 M365, Horizon3 CIMS, Transportplan).
- Copy to clipboard + mailto: link.
- "Mark as sent" sets task to `waiting_external`.
- **Test**: open dialog for each external task, verify email content, mark as sent.

### Step 7 — Cores M365 provisioning integration
- Connect `provision-cores-m365` task to existing automation.
- Show "Trigger provisioning" button if not yet triggered.
- Show "Retry" button on failure.
- Reflect provisioning job status in task status.
- **Test**: trigger provisioning from onboarding, verify task status updates.

### Step 8 — Conditional task filtering
- Phase 5 (Transportplan setup) only appears for Transport/Operations/Planning/Logistics.
- Task 7 (`request-transportplan`) in Phase 3 also conditional on same departments.
- Verification tasks 31 + 32 in Phase 8 also conditional.
- Verify `initializeOnboarding` correctly filters based on department.
- **Test**: create employee in Sales dept → no Phase 5, no Transportplan request task, no Transportplan verification items. Create in Transport → all appear.

### Step 9 — Verification phase (static checklist)
- Phase 8 uses the 12 static verification tasks defined in the template.
- Conditional verification tasks (Transportplan, Windows App) are filtered by department.
- Admin checks each item to confirm the system works.
- **Test**: complete all previous phases → Phase 8 unlocks with correct checklist items for the employee's department.

### Step 10 — i18n + notifications + polish
- Add all EN/NL translations.
- Trigger notifications on phase completion and onboarding completion.
- Add `CompletionCard` for finished onboarding.
- Polish: loading states, error handling, empty states, responsive layout.
- **Test**: switch language, verify all strings. Complete onboarding, verify notification.

---

## 14. Decisions made

1. **Phase-level dependencies**: Start simple with phase-level dependencies. Per-task dependencies can be added later if needed.
2. **Static verification checklist**: Phase 8 uses a static checklist of 12 items matching the workflow document. No auto-generation.
3. **Admin-only view**: The data model supports employee-facing views via the assignee field, but no employee view is built now.
4. **No reminder notifications**: Deferred. The admin can see waiting tasks in the timeline.
5. **Hardcoded email templates**: Both the Horizon3 and Transportplan request emails are hardcoded for now.