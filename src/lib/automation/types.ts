export type AutomationService = 'M365' | 'Apple ID';

export interface GraphSharedMailbox {
  email: string;
  displayName: string;
}

export interface GraphSecurityGroup {
  id: string;
  displayName: string;
}

export interface GraphResourcesResult {
  sharedMailboxes: GraphSharedMailbox[];
  securityGroups: GraphSecurityGroup[];
}

export interface CreateEmployeeInput {
  firstName: string;
  lastName: string;
  workEmail?: string;
  personalEmail?: string;
  role: string;
  department: string;
  startDate: string;
  contractType: string;
  workPhone?: string;
  personalPhone?: string;
}

export interface CreateEmployeeResult {
  id: string;
  email: string;
}

export interface TriggerAutomationInput {
  employeeId: string;
  service?: AutomationService;
  selectedMailboxes?: string[];
  selectedGroupIds?: string[];
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
