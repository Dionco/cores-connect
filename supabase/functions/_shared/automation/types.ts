export type AutomationService = 'M365' | 'Apple ID';
export type JobStatus = 'Queued' | 'Running' | 'Completed' | 'Failed';

export interface EmployeeRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  department:
    | 'Sales'
    | 'Customs & Compliance'
    | 'Transport'
    | 'Operations'
    | 'Planning'
    | 'Logistics';
  status: 'Active' | 'Inactive' | 'Onboarding';
}

export interface ProvisioningJobRow {
  id: string;
  employee_id: string;
  service: AutomationService;
  status: JobStatus;
  retry_count: number;
  idempotency_key: string | null;
  metadata?: {
    source?: 'manual-ui-trigger' | 'retry-endpoint';
    workflow?: string;
    selectedMailboxes?: string[];
    selectedGroupIds?: string[];
  } | null;
}

export interface ProvisioningStep {
  step: string;
  status: 'done' | 'pending' | 'error';
  timestamp: string;
}

export interface TriggerResult {
  status: JobStatus;
  jobId: string;
  reused: boolean;
}

export interface RetryResult {
  status: JobStatus;
  jobId: string;
  retryCount: number;
}

export interface ProvisioningOptions {
  selectedMailboxes?: string[];
  selectedGroupIds?: string[];
}

export interface ProvisioningProvider {
  service: AutomationService;
  workflowName: string;
  run: (employee: EmployeeRow, options?: ProvisioningOptions) => Promise<ProvisioningStep[]>;
}
