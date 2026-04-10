// ---------------------------------------------------------------------------
// Onboarding workflow types
// ---------------------------------------------------------------------------

// --- Template types (constant, shared across all employees) ----------------

export type TaskAssignee = 'admin' | 'employee' | 'horizon3' | 'transportplan_admin';

export type TaskCondition = {
  field: 'department';
  values: string[];
};

export type TaskInstruction = {
  steps: string[];
  links?: { label: string; url: string }[];
  notes?: string;
};

export type TaskActionType =
  | 'generate_email'
  | 'trigger_provisioning'
  | 'retry_provisioning';

export type OnboardingTaskTemplate = {
  id: string;
  phaseId: string;
  title: string;
  description: string;
  assignee: TaskAssignee;
  order: number;
  condition?: TaskCondition;
  instructions?: TaskInstruction;
  automatable?: boolean;
  actionType?: TaskActionType;
};

export type OnboardingPhaseTemplate = {
  id: string;
  title: string;
  description: string;
  order: number;
  dependsOn: string[];
};

// --- Instance types (per employee, mutable) --------------------------------

export type OnboardingTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'waiting_external'
  | 'completed'
  | 'skipped';

export type OnboardingTaskInstance = {
  taskTemplateId: string;
  status: OnboardingTaskStatus;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
};

export type OnboardingPhaseStatus =
  | 'locked'
  | 'available'
  | 'in_progress'
  | 'waiting'
  | 'completed';

export type OnboardingWorkflowStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed';

export type OnboardingWorkflow = {
  id: string;
  employeeId: string;
  status: OnboardingWorkflowStatus;
  tasks: OnboardingTaskInstance[];
  createdAt: string;
  updatedAt: string;
};

// --- Computed types (derived at read time, not stored) ----------------------

export type PhaseProgress = {
  completed: number;
  total: number;
};

export type PhaseComputed = {
  phase: OnboardingPhaseTemplate;
  status: OnboardingPhaseStatus;
  progress: PhaseProgress;
  tasks: (OnboardingTaskTemplate & { instance: OnboardingTaskInstance })[];
};
