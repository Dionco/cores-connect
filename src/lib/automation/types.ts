export type AutomationService = 'M365' | 'Apple ID';

export interface TriggerAutomationInput {
  employeeId: string;
  service?: AutomationService;
}

export interface TriggerAutomationResult {
  status: 'Queued' | 'Running' | 'Completed' | 'Failed';
  jobId: string;
  reused: boolean;
}

export interface RetryAutomationResult {
  status: 'Queued' | 'Running' | 'Completed' | 'Failed';
  jobId: string;
  retryCount: number;
}
