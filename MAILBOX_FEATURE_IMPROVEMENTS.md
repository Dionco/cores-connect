# Mailbox Assignment Feature - Improvements & Testing Guide

## Summary of Changes

I've made comprehensive improvements to make mailbox assignment errors and results much more visible. The changes focus on **better visibility into what succeeded and what failed**, which is essential for troubleshooting mailbox assignment issues.

## 1. Enhanced Provisioning Logs Display

### New Log Analyzer Component
**File:** `src/lib/provisioning/logAnalyzer.ts`

- Parses provisioning job logs to extract:
  - Successfully assigned mailboxes with email addresses
  - Failed mailbox assignments with specific error messages
  - Successfully assigned security groups
  - Failed security group assignments with specifics
  - Summary statistics (success count, error count, pending count)

### Improved Provisioning Page Drawer
**File:** `src/pages/ProvisioningPage.tsx`

Enhanced the provisioning job detail drawer to show:

1. **Provisioning Summary Section** (new) - Shows separate visual breakdowns:
   - ✅ **Shared Mailboxes Added** (green banner): Lists each successfully added mailbox
   - ❌ **Shared Mailbox Failures** (red banner): Shows mailbox + specific error for each failure
   - ✅ **Security Groups Added** (green banner): Lists successfully added groups
   - ❌ **Security Group Failures** (red banner): Shows group ID + error details
   - ⚠️ **Provisioning Failed banner**: Appears when job overall status is Failed

2. **Full Execution Log** (reorganized): Simplified list of all steps with timestamps

**Why this matters:** When a mailbox assignment fails, you can now immediately see:
- Which mailbox failed (e.g., `trading@cores.nl`)
- The exact error message (e.g., "Error executing cmdlet", "user not found", etc.)
- This lets you distinguish between permission errors vs. mailbox configuration errors

## 2. Improved Employee Creation Success Screen

**File:** `src/components/AddEmployeeDialog.tsx`

Enhanced the success screen after account creation to show:

- ✅ Department information
- ✅ Provisioning status badge
- 📧 **Shared Mailboxes** section (if any selected): Green banner with all assigned mailboxes
- 🔐 **Security Groups** section (if any selected): Green banner with all assigned groups  
- 🔗 Link to Provisioning page to view detailed logs

**Why this matters:** Users get immediate confirmation of what was provisioned and can drill into details via the Provisioning page.

## 3. Better Error Messaging During Setup

**File:** `src/components/AddEmployeeDialog.tsx` (Step 2: Shared Mailboxes)

When mailboxes fail to load, the UI now shows:

1. **Error header:** "Failed to load shared mailboxes"
2. **Error context:** The specific error from the API
3. **Diagnostic hints:** 3 bullet points explaining possible causes:
   - No shared mailboxes exist in your organization
   - Configured mailboxes (env vars) are not found
   - API permissions or configuration needs adjustment
4. **Retry button:** Easily retry loading

**Why this matters:** Instead of just saying "Failed to load", users understand it might be a config issue or permission problem (e.g., missing `Exchange.ManageAsApp` permission).

## 4. Enhanced Logging in Microsoft Provider

**File:** `supabase/functions/_shared/providers/microsoft.ts`

Added comprehensive console.log statements to trace execution:

```typescript
console.log('[M365 Provider] Starting provisioning', {
  employeeId,
  selectedMailboxesCount,
  configuredMailboxes: {...},
  // ...
});

console.log('[M365 Provider] Mailbox assignment details', {
  manualSelectionProvided,
  selectedMailboxes,
  uniqueTargets,
  // ...
});

console.log('[M365 Provider] Attempting mailbox assignment', { mailboxEmail, userUpn });
console.log('[M365 Provider] Mailbox assignment succeeded', { mailboxEmail, attempts, latencyMs });
console.error('[M365 Provider] Mailbox assignment failed', { mailboxEmail, error: message });
```

**Why this matters:** When debugging in Supabase Edge Function logs, you'll see:
- What mailboxes were targeted (configured vs. manual selection)
- Which ones succeeded and took how long
- Exact error messages for failures

## Testing the Mailbox Feature

### Prerequisites
Ensure these environment variables are configured:
- `MS_GRAPH_TENANT_ID` - Azure tenant ID
- `MS_GRAPH_CLIENT_ID` - Entra app client ID
- `MS_GRAPH_CLIENT_SECRET` - Entra app secret
- `MS_GRAPH_DOMAIN` - Domain (e.g., `cores.nl`)
- `MS_EXO_SHARED_MAILBOX_TRADING` - Trading mailbox email (e.g., `trading@cores.nl`)  
- `MS_EXO_SHARED_MAILBOX_SALES` - Sales mailbox email
- `MS_EXO_SHARED_MAILBOX_CUSTOMS` - Customs mailbox email
- `MS_EXO_SHARED_MAILBOX_TRANSPORT` - Transport mailbox email
- `MS_GRAPH_BUSINESS_PREMIUM_SKU_ID` - SKU ID for license

### Test Scenario 1: Successful Mailbox Assignment

1. Open the app and go to the Employees page
2. Click "Add New Employee"
3. Fill in Employee Details (Step 1)
4. **Step 2: Shared Mailboxes**
   - ✅ Verify mailboxes load without error
   - ✅ Select 1-2 mailboxes (e.g., Trading + Department-specific)
   - 📝 Note which ones you selected
5. **Step 3: Security Groups** (optional)
   - Select 1-2 groups
6. **Step 4: Review & Create**
   - Click "Create Account"
7. **Verify Success Screen:**
   - ✅ See employee name
   - ✅ See provisioning status = "Provisioned"
   - ✅ See selected mailboxes in green banner
   - ✅ See selected groups in green banner (if any)
8. **Go to Provisioning Page:**
   - Click "View detailed logs" link or navigate to /provisioning
   - Click on the job you just created
   - In the drawer, verify:
     - ✅ "Shared Mailboxes Added" section lists your selected mailboxes
     - ✅ No "Shared Mailbox Failures" section (if all succeeded)
     - ✅ Message says "Granted FullAccess on shared mailbox [email]"

### Test Scenario 2: Mailbox Assignment with Errors

If you want to test error handling:

1. Configure a fake/non-existent mailbox in an environment variable
2. Create an employee
3. **Verify Error Display:**
   - ❌ In Provisioning Page drawer, see "Shared Mailbox Failures" section in red
   - ✅ Error message shows specific failure reason (e.g., "Error executing cmdlet", "mailbox not found")
   - ✅ Groups still assigned (if selected) - mailbox errors don't block group assignment

### Test Scenario 3: No Mailboxes Available

If you want to test the "no mailboxes" case:

1. Clear the shared mailbox environment variables
2. Create an employee  
3. **Verify UI Shows:**
   - ✅ Step 2 shows message: "No shared mailboxes available"
   - ✅ With helpful bullet points explaining possible causes
   - ✅ "Retry Loading" button works

### Test Scenario 4: Retry Failed Job

1. Create an employee (let it fail on mailbox assignment intentionally if possible)
2. Go to Provisioning page
3. Find the failed job
4. ✅ Verify "Retry" button appears
5. Click "Retry"
6. ✅ Verify job status changes to Running/Queued
7. ✅ Re-check drawer to see updated results

## Debugging with Logs

### Browser Console
- Check for any fetch errors or client-side issues
- Look for "failed to create employee" or "onboarding-trigger failed" messages

### Supabase Edge Function Logs
In Supabase dashboard, check function logs for `onboarding-trigger` and look for:

```
[M365 Provider] Starting provisioning {
  selectedMailboxesCount: 2,
  configuredMailboxes: { trading: "trading@cores.nl", ... }
}

[M365 Provider] Mailbox assignment details {
  manualSelectionProvided: true,
  uniqueTargets: ["trading@cores.nl", "sales@cores.nl"]
}

[M365 Provider] Attempting mailbox assignment { mailboxEmail: "trading@cores.nl", ... }
[M365 Provider] Mailbox assignment succeeded { mailboxEmail: "trading@cores.nl", attempts: 1, latencyMs: 523 }
```

### Common Issues & Solutions

| Symptom | Likely Cause | Solution |
|---------|------------|----------|
| "No shared mailboxes available" in UI | Mailboxes aren't configured, or API call to get them failed | Check env vars `MS_EXO_SHARED_MAILBOX_*` are set. Check logs for Graph/EXO token errors |
| Mailbox step shows error "Failed to load shared mailboxes" | Permission issue or API misconfiguration | Verify `Exchange.ManageAsApp` permission is granted. Check tenant ID, client ID, secret |
| Job shows "Granted FullAccess" but user doesn't have access | EXO API call succeeded but propagation delay | Normal - wait a few minutes for AD replication |
| Job shows "Error executing cmdlet" in red | Mailbox doesn't exist or user doesn't exist yet | Verify mailbox email is correct. Wait for user creation to propagate (10 sec delay already in code) |
| Job shows error for ONE mailbox but others succeeded | Non-fatal errors - continuing as designed | This is correct behavior - mailbox errors don't block group assignment |

## Implementation Details

### Data Flow

1. **UI (AddEmployeeDialog)**
   - Collects selected mailboxes and groups
   - Passes to `triggerOnboardingAutomation({ employeeId, selectedMailboxes, selectedGroupIds })`

2. **Edge Function (onboarding-trigger)**
   - Receives request with employee ID + selections
   - Calls `triggerProvisioningForEmployee` with options

3. **Edge Function (provisioning core)**
   - Stores selections in `provisioning_jobs.metadata`
   - Calls Microsoft provider with `options`

4. **Microsoft Provider (microsoft.ts)**
   - Gets Graph token (for user creation, groups)
   - Gets EXO token (for mailboxes) 
   - For each selected/configured mailbox:
     - Calls EXO API `Add-MailboxPermission`
     - Logs success or error with details
   - Returns detailed logs array

5. **Database (provisioning_jobs table)**
   - Stores all logs with status ('done' / 'error')
   - Job status is 'Completed' (even if some steps errored) or 'Failed' (if thrown)

6. **UI (ProvisioningPage)**
   - Reads logs from job
   - Uses `analyzeProvisioningLogs` to parse them
   - Groups them by category (mailbox success/fail, group success/fail, etc.)
   - Displays color-coded sections

### Why Mailboxes Might Not Be Added

1. **EXO Permission Missing**: App doesn't have `Exchange.ManageAsApp` permission
   - **Fix:** Grant permission in Azure app registration Entra > API permissions
   - **Evidence:** Error in logs: "user lacks required app permission"

2. **Mailbox Email Wrong**: Environment variable has wrong email
   - **Fix:** Verify `MS_EXO_SHARED_MAILBOX_*` env vars
   - **Evidence:** Error: "Mailbox not found" or "couldn't be found"

3. **User Not Created Yet**: EXO call happens before user propagates through AD
   - **Fix:** Already handled - 10 second wait after user creation
   - **Evidence:** Would see timing error, but rare

4. **API Timeout or Network Issue**: Transient network problem
   - **Fix:** Automatic retry (6 attempts by default with exponential backoff)
   - **Evidence:** "Attempt 3/6" in error message, then eventually succeeds or times out

5. **No Mailboxes Selected**: User didn't select any in Step 2
   - **Fix:** Have user select mailboxes in dialog Step 2
   - **Evidence:** Log says "Skipped shared mailbox assignment (no mailboxes selected)"

## Files Modified

- ✅ `src/lib/provisioning/logAnalyzer.ts` - NEW
- ✅ `src/pages/ProvisioningPage.tsx` - Enhanced drawer with summary
- ✅ `src/components/AddEmployeeDialog.tsx` - Better success screen + error messaging
- ✅ `supabase/functions/_shared/providers/microsoft.ts` - Added detailed logging

## Next Steps if Issues Persist

1. **Check Supabase function logs** - Look for console.log statements from Microsoft provider
2. **Verify EXO permissions** - Ensure app has `Exchange.ManageAsApp` in Azure
3. **Test token acquisition** - Call `graph-health-check` function to verify tokens work
4. **Check mailbox configuration** - Verify env vars match actual mailbox emails
5. **Try with configured mailbox first** - Don't select manually yet, use defaults

---

All changes are backward compatible and non-breaking. Existing provisioning jobs will continue to work, and retry functionality is preserved.
