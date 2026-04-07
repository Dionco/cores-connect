import type { ProvisioningJob } from '@/data/mockData';

export interface ProvisioningLogSummary {
  successCount: number;
  errorCount: number;
  pendingCount: number;
  mailboxResults: {
    succeeded: string[];
    failed: Array<{ email: string; error: string }>;
  };
  groupResults: {
    succeeded: string[];
    failed: Array<{ id: string; error: string }>;
  };
  otherResults: {
    succeeded: string[];
    failed: Array<{ step: string; error: string }>;
  };
  hasMailboxErrors: boolean;
  hasGroupErrors: boolean;
  hasOtherErrors: boolean;
}

export const analyzeProvisioningLogs = (job: ProvisioningJob): ProvisioningLogSummary => {
  const summary: ProvisioningLogSummary = {
    successCount: 0,
    errorCount: 0,
    pendingCount: 0,
    mailboxResults: { succeeded: [], failed: [] },
    groupResults: { succeeded: [], failed: [] },
    otherResults: { succeeded: [], failed: [] },
    hasMailboxErrors: false,
    hasGroupErrors: false,
    hasOtherErrors: false,
  };

  for (const log of job.logs) {
    if (log.status === 'done') {
      summary.successCount += 1;
    } else if (log.status === 'error') {
      summary.errorCount += 1;
    } else if (log.status === 'pending') {
      summary.pendingCount += 1;
    }

    const step = log.step.toLowerCase();

    // Analyze mailbox results
    if (step.includes('shared mailbox') || step.includes('fullaccess')) {
      if (log.status === 'done') {
        const match = log.step.match(/Granted FullAccess on shared mailbox (\S+)|User already has FullAccess on shared mailbox (\S+)/);
        const email = match?.[1] || match?.[2];
        if (email) summary.mailboxResults.succeeded.push(email);
      } else if (log.status === 'error') {
        const match = log.step.match(/Shared mailbox assignment failed for (\S+):|failed for (\S+):/);
        const email = match?.[1] || match?.[2];
        const errorMsg = log.step.substring(log.step.lastIndexOf(':') + 1).trim();
        if (email) {
          summary.mailboxResults.failed.push({ email, error: errorMsg });
          summary.hasMailboxErrors = true;
        }
      }
    }

    // Analyze security group results
    if (step.includes('security group') || step.includes('added user to')) {
      if (log.status === 'done') {
        if (step.includes('already in security group')) {
          const match = log.step.match(/already in security group ([a-f0-9-]+)/);
          if (match) summary.groupResults.succeeded.push(match[1]);
        } else if (step.includes('added user to security group')) {
          const match = log.step.match(/Added user to security group ([a-f0-9-]+)/);
          if (match) summary.groupResults.succeeded.push(match[1]);
        }
      } else if (log.status === 'error') {
        const match = log.step.match(/security group ([a-f0-9-]+)/);
        const groupId = match?.[1];
        const errorMsg = log.step.substring(log.step.lastIndexOf(':') + 1).trim();
        if (groupId) {
          summary.groupResults.failed.push({ id: groupId, error: errorMsg });
          summary.hasGroupErrors = true;
        }
      }
    }

    // Other results (license, SharePoint, etc)
    if (!step.includes('shared mailbox') && !step.includes('security group') && !step.includes('fullaccess')) {
      if (log.status === 'done' && !step.includes('skipped')) {
        summary.otherResults.succeeded.push(log.step);
      } else if (log.status === 'error') {
        summary.otherResults.failed.push({ step: log.step, error: log.step });
        summary.hasOtherErrors = true;
      }
    }
  }

  return summary;
};

export const getSummaryMessage = (summary: ProvisioningLogSummary): string => {
  const parts: string[] = [];

  if (summary.successCount > 0) {
    parts.push(`✓ ${summary.successCount} step${summary.successCount !== 1 ? 's' : ''} succeeded`);
  }

  if (summary.mailboxResults.succeeded.length > 0) {
    parts.push(`✓ ${summary.mailboxResults.succeeded.length} mailbox${summary.mailboxResults.succeeded.length !== 1 ? 'es' : ''}`);
  }

  if (summary.groupResults.succeeded.length > 0) {
    parts.push(`✓ ${summary.groupResults.succeeded.length} group${summary.groupResults.succeeded.length !== 1 ? 's' : ''}`);
  }

  if (summary.errorCount > 0) {
    parts.push(`✗ ${summary.errorCount} error${summary.errorCount !== 1 ? 's' : ''}`);
  }

  return parts.join(' • ');
};
