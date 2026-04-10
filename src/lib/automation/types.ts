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

export type OnboardingProvisioningStatus = 'completed' | 'running' | 'failed';

export type OnboardingTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'waiting_external'
  | 'completed'
  | 'skipped';

export interface InitializeOnboardingInput {
  employeeId: string;
  provisioningStatus?: OnboardingProvisioningStatus;
}

export interface InitializeOnboardingResult {
  workflowId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  created: boolean;
}

export interface UpdateOnboardingTaskInput {
  employeeId: string;
  taskTemplateId: string;
  status?: OnboardingTaskStatus;
  toggleCompleted?: boolean;
  note?: string;
}

export interface UpdateOnboardingTaskResult {
  workflowId: string;
  workflowStatus: 'not_started' | 'in_progress' | 'completed';
  task: {
    id: string;
    task_template_id: string;
    status: OnboardingTaskStatus;
    completed_at: string | null;
    completed_by: string | null;
    notes: string | null;
  };
}
