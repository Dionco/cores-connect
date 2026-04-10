import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  OnboardingWorkflow,
  OnboardingWorkflowStatus,
  OnboardingTaskInstance,
  OnboardingTaskStatus,
  OnboardingPhaseStatus,
  PhaseComputed,
} from '@/data/onboardingTypes';
import {
  ONBOARDING_PHASES,
  ONBOARDING_TASKS,
  getApplicableTasks,
  isPhaseApplicable,
} from '@/data/onboardingTemplate';
import {
  initializeOnboardingWorkflow,
  retryProvisioningAutomation,
  triggerOnboardingAutomation,
  updateOnboardingTask,
} from '@/lib/automation/client';
import { mockEmployees, mockProvisioningJobs } from '@/data/mockData';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const QUERY_KEY_PREFIX = 'onboarding';
const MOCK_STORAGE_KEY = 'cores:onboarding';
const PROVISIONING_QUERY_KEY_PREFIX = 'onboarding-provisioning-job';
const MOCK_PROVISIONING_STORAGE_KEY = 'cores:onboarding:provisioning';
const PROVISIONING_TASK_TEMPLATE_ID = 'provision-cores-m365';

type ProvisioningJobStatus = 'Queued' | 'Running' | 'Completed' | 'Failed';

type ProvisioningJobSnapshot = {
  jobId: string;
  status: ProvisioningJobStatus;
  retryCount: number;
};

type ProvisioningJobRow = {
  id: string;
  status: ProvisioningJobStatus;
  retry_count: number | null;
};

type SeededTaskProfile = {
  completedTaskIds?: string[];
  inProgressTaskIds?: string[];
  waitingExternalTaskIds?: string[];
  skippedTaskIds?: string[];
  notesByTaskId?: Record<string, string>;
};

const SEEDED_TASK_PROFILES_BY_EMPLOYEE_ID: Record<string, SeededTaskProfile> = {
  'emp-007': {
    completedTaskIds: [
      'collect-employee-info',
      'provision-cores-m365',
      'create-tribe-crm',
      'create-slite',
      'create-apple-business-manager',
      'deliver-onboarding-docs',
    ],
    waitingExternalTaskIds: [
      'request-horizon3-m365',
      'request-horizon3-cims',
    ],
    notesByTaskId: {
      'request-horizon3-m365': 'Request sent to Horizon3 admin. Waiting for credentials.',
    },
  },
  'emp-008': {
    completedTaskIds: [
      'collect-employee-info',
      'request-horizon3-m365',
      'request-horizon3-cims',
      'create-tribe-crm',
      'create-slite',
      'create-apple-business-manager',
      'deliver-onboarding-docs',
    ],
    waitingExternalTaskIds: ['request-transportplan'],
    notesByTaskId: {
      'request-transportplan': 'Transportplan request sent. Waiting for external admin response.',
      'provision-cores-m365': 'Previous provisioning run failed. Use retry action to continue.',
    },
  },
  'emp-009': {
    completedTaskIds: ['collect-employee-info'],
    inProgressTaskIds: ['create-apple-business-manager'],
    waitingExternalTaskIds: ['request-horizon3-m365'],
    notesByTaskId: {
      'request-horizon3-m365': 'Initial request sent and acknowledged by Horizon3.',
    },
  },
};

function storageKeyFor(employeeId: string) {
  return `${MOCK_STORAGE_KEY}:${employeeId}`;
}

function provisioningStorageKeyFor(employeeId: string) {
  return `${MOCK_PROVISIONING_STORAGE_KEY}:${employeeId}`;
}

function toIsoDateTime(date: string, hour = 9, minute = 0) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${date}T${hh}:${mm}:00.000Z`;
}

function normalizeMockDateTime(value: string) {
  return value.includes('T') ? value : value.replace(' ', 'T');
}

function mapProvisioningJobStatusToTaskStatus(
  status?: ProvisioningJobStatus,
): OnboardingTaskStatus | undefined {
  if (status === 'Completed') return 'completed';
  if (status === 'Running' || status === 'Queued') return 'in_progress';
  if (status === 'Failed') return 'pending';
  return undefined;
}

function applyProvisioningTaskStatusOverride(
  tasks: OnboardingTaskInstance[],
  statusOverride?: OnboardingTaskStatus,
): OnboardingTaskInstance[] {
  if (!statusOverride) return tasks;

  return tasks.map((task) => {
    if (task.taskTemplateId !== PROVISIONING_TASK_TEMPLATE_ID) {
      return task;
    }

    if (task.status === statusOverride) {
      return task;
    }

    const next: OnboardingTaskInstance = {
      ...task,
      status: statusOverride,
    };

    if (statusOverride !== 'completed') {
      next.completedAt = undefined;
      next.completedBy = undefined;
    }

    return next;
  });
}

// ---------------------------------------------------------------------------
// Mock localStorage helpers
// ---------------------------------------------------------------------------

function getStoredWorkflow(employeeId: string): OnboardingWorkflow | null {
  const raw = localStorage.getItem(storageKeyFor(employeeId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OnboardingWorkflow;
  } catch {
    return null;
  }
}

function setStoredWorkflow(workflow: OnboardingWorkflow) {
  localStorage.setItem(
    storageKeyFor(workflow.employeeId),
    JSON.stringify({ ...workflow, updatedAt: new Date().toISOString() }),
  );
}

function getStoredProvisioningJob(employeeId: string): ProvisioningJobSnapshot | null {
  const raw = localStorage.getItem(provisioningStorageKeyFor(employeeId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ProvisioningJobSnapshot;
  } catch {
    return null;
  }
}

function setStoredProvisioningJob(
  employeeId: string,
  snapshot: ProvisioningJobSnapshot,
) {
  localStorage.setItem(provisioningStorageKeyFor(employeeId), JSON.stringify(snapshot));
}

function cloneWorkflow(workflow: OnboardingWorkflow): OnboardingWorkflow {
  return {
    ...workflow,
    tasks: workflow.tasks.map((task) => ({ ...task })),
  };
}

function cloneProvisioningJobSnapshot(
  snapshot: ProvisioningJobSnapshot,
): ProvisioningJobSnapshot {
  return { ...snapshot };
}

function buildSeededWorkflow(employeeId: string): OnboardingWorkflow | null {
  const employee = mockEmployees.find((entry) => entry.id === employeeId);
  if (!employee) {
    return null;
  }

  const applicableTasks = getApplicableTasks(employee.department);
  const taskIds = applicableTasks.map((task) => task.id);
  const profile = SEEDED_TASK_PROFILES_BY_EMPLOYEE_ID[employeeId];
  const shouldMarkAllCompleted = employee.status !== 'Onboarding' && !profile;

  const completedIds = new Set<string>(shouldMarkAllCompleted ? taskIds : profile?.completedTaskIds || []);
  const inProgressIds = new Set<string>(profile?.inProgressTaskIds || []);
  const waitingIds = new Set<string>(profile?.waitingExternalTaskIds || []);
  const skippedIds = new Set<string>(profile?.skippedTaskIds || []);

  completedIds.add('collect-employee-info');

  const completedAt = toIsoDateTime(employee.startDate, 10, 0);
  const tasks: OnboardingTaskInstance[] = applicableTasks.map((template) => {
    let status: OnboardingTaskStatus = 'pending';
    if (skippedIds.has(template.id)) {
      status = 'skipped';
    } else if (waitingIds.has(template.id)) {
      status = 'waiting_external';
    } else if (inProgressIds.has(template.id)) {
      status = 'in_progress';
    } else if (completedIds.has(template.id)) {
      status = 'completed';
    }

    return {
      taskTemplateId: template.id,
      status,
      completedAt: status === 'completed' ? completedAt : undefined,
      completedBy: status === 'completed' ? 'HR Admin' : undefined,
      notes: profile?.notesByTaskId?.[template.id],
    };
  });

  const now = new Date().toISOString();
  const workflow: OnboardingWorkflow = {
    id: `ob-seed-${employee.id}`,
    employeeId: employee.id,
    status: 'in_progress',
    tasks,
    createdAt: toIsoDateTime(employee.startDate, 8, 30),
    updatedAt: now,
  };

  workflow.status = deriveWorkflowStatus(workflow, new Set(taskIds));
  return workflow;
}

function getSeededWorkflow(employeeId: string): OnboardingWorkflow | null {
  const seeded = buildSeededWorkflow(employeeId);
  return seeded ? cloneWorkflow(seeded) : null;
}

function getWorkflowFromStorageOrSeed(employeeId: string): OnboardingWorkflow | null {
  return getStoredWorkflow(employeeId) || getSeededWorkflow(employeeId);
}

function getSeededProvisioningJob(employeeId: string): ProvisioningJobSnapshot | null {
  let latest: ProvisioningJobSnapshot | null = null;
  let latestTimestamp = 0;

  for (const job of mockProvisioningJobs) {
    if (job.employeeId !== employeeId || job.service !== 'M365') {
      continue;
    }

    const triggeredAt = Date.parse(normalizeMockDateTime(job.triggeredAt));
    if (triggeredAt >= latestTimestamp) {
      latestTimestamp = triggeredAt;
      latest = {
        jobId: job.id,
        status: job.status,
        retryCount: job.status === 'Failed' ? 1 : 0,
      };
    }
  }

  return latest;
}

function getProvisioningJobFromStorageOrSeed(
  employeeId: string,
): ProvisioningJobSnapshot | null {
  return getStoredProvisioningJob(employeeId) || getSeededProvisioningJob(employeeId);
}

// ---------------------------------------------------------------------------
// Core logic (works for both mock and remote)
// ---------------------------------------------------------------------------

function buildInitialTasks(
  department: string,
  provisioningStatus?: 'completed' | 'running' | 'failed',
): OnboardingTaskInstance[] {
  const applicable = getApplicableTasks(department);

  return applicable.map((template) => {
    let status: OnboardingTaskStatus = 'pending';

    // Phase 1 task is auto-completed
    if (template.id === 'collect-employee-info') {
      status = 'completed';
    }

    // Cores M365 provisioning reflects existing job state
    if (template.id === 'provision-cores-m365' && provisioningStatus) {
      if (provisioningStatus === 'completed') status = 'completed';
      else if (provisioningStatus === 'running') status = 'in_progress';
      // 'failed' stays as pending so admin can retry
    }

    return {
      taskTemplateId: template.id,
      status,
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    };
  });
}

function getApplicableTaskIdSet(department: string): Set<string> {
  return new Set(getApplicableTasks(department).map((task) => task.id));
}

function filterApplicableTasks(
  tasks: OnboardingTaskInstance[],
  applicableTaskIds: Set<string>,
): OnboardingTaskInstance[] {
  return tasks.filter((task) => applicableTaskIds.has(task.taskTemplateId));
}

function getTaskTemplate(taskTemplateId: string) {
  return ONBOARDING_TASKS.find((template) => template.id === taskTemplateId);
}

function assertTaskCanBeUpdated(
  workflow: OnboardingWorkflow,
  taskTemplateId: string,
  department: string,
  applicableTaskIds: Set<string>,
) {
  const taskTemplate = getTaskTemplate(taskTemplateId);
  if (!taskTemplate) {
    throw new Error('Task template not found.');
  }

  if (!applicableTaskIds.has(taskTemplateId)) {
    throw new Error('Task is not applicable for this employee.');
  }

  const applicableTasks = filterApplicableTasks(workflow.tasks, applicableTaskIds);
  const phaseStatuses = computeAllPhaseStatuses(applicableTasks, department, applicableTaskIds);
  const taskPhaseStatus = phaseStatuses.get(taskTemplate.phaseId);

  if (taskPhaseStatus === 'locked') {
    throw new Error('Task is locked until prerequisite phases are completed.');
  }
}

/** Determine the status of a single phase based on its task instances. */
function computeSinglePhaseStatus(
  phaseId: string,
  tasks: OnboardingTaskInstance[],
  allPhaseStatuses: Map<string, OnboardingPhaseStatus>,
  applicableTaskIds: Set<string>,
): OnboardingPhaseStatus {
  const phase = ONBOARDING_PHASES.find((p) => p.id === phaseId);
  if (!phase) return 'locked';

  // Check dependencies
  for (const depId of phase.dependsOn) {
    const depStatus = allPhaseStatuses.get(depId);
    // A dependency phase that has no tasks (fully conditional and skipped) counts as completed
    if (depStatus !== 'completed') return 'locked';
  }

  const phaseTasks = tasks.filter((t) => {
    const tmpl = ONBOARDING_TASKS.find((tt) => tt.id === t.taskTemplateId);
    return tmpl?.phaseId === phaseId && applicableTaskIds.has(t.taskTemplateId);
  });

  if (phaseTasks.length === 0) return 'completed'; // empty phase (all tasks filtered out)

  const allDone = phaseTasks.every((t) => t.status === 'completed' || t.status === 'skipped');
  if (allDone) return 'completed';

  const anyStarted = phaseTasks.some(
    (t) => t.status === 'in_progress' || t.status === 'completed' || t.status === 'waiting_external',
  );
  const allAdminDone = phaseTasks
    .filter((t) => {
      const tmpl = ONBOARDING_TASKS.find((tt) => tt.id === t.taskTemplateId);
      return tmpl?.assignee === 'admin';
    })
    .every((t) => t.status === 'completed' || t.status === 'skipped');

  const anyWaiting = phaseTasks.some((t) => t.status === 'waiting_external');

  if (anyWaiting && allAdminDone) return 'waiting';
  if (anyStarted) return 'in_progress';

  return 'available';
}

/** Compute statuses for all phases in dependency order. */
function computeAllPhaseStatuses(
  tasks: OnboardingTaskInstance[],
  department: string,
  applicableTaskIds: Set<string>,
): Map<string, OnboardingPhaseStatus> {
  const result = new Map<string, OnboardingPhaseStatus>();

  // Process phases in order so dependencies are resolved first
  const sorted = [...ONBOARDING_PHASES].sort((a, b) => a.order - b.order);

  for (const phase of sorted) {
    // If the entire phase is not applicable, mark completed immediately
    if (!isPhaseApplicable(phase.id, department)) {
      result.set(phase.id, 'completed');
      continue;
    }
    result.set(phase.id, computeSinglePhaseStatus(phase.id, tasks, result, applicableTaskIds));
  }

  return result;
}

/** Build the full computed view for the UI. */
function buildPhaseComputedList(
  workflow: OnboardingWorkflow,
  department: string,
  latestProvisioningJobStatus?: ProvisioningJobStatus,
  applicableTaskIds?: Set<string>,
): PhaseComputed[] {
  const provisioningTaskStatus = mapProvisioningJobStatusToTaskStatus(latestProvisioningJobStatus);
  const resolvedApplicableTaskIds = applicableTaskIds || getApplicableTaskIdSet(department);

  const tasksWithProvisioningStatus = applyProvisioningTaskStatusOverride(
    workflow.tasks,
    provisioningTaskStatus,
  );
  const applicableTasks = filterApplicableTasks(tasksWithProvisioningStatus, resolvedApplicableTaskIds);
  const statuses = computeAllPhaseStatuses(applicableTasks, department, resolvedApplicableTaskIds);

  return ONBOARDING_PHASES
    .filter((phase) => isPhaseApplicable(phase.id, department))
    .sort((a, b) => a.order - b.order)
    .map((phase) => {
      const phaseTasks = applicableTasks
        .map((inst) => {
          const tmpl = ONBOARDING_TASKS.find((t) => t.id === inst.taskTemplateId);
          if (!tmpl || tmpl.phaseId !== phase.id) return null;

          if (tmpl.id === PROVISIONING_TASK_TEMPLATE_ID) {
            return {
              ...tmpl,
              actionType:
                latestProvisioningJobStatus === 'Failed'
                  ? 'retry_provisioning'
                  : 'trigger_provisioning',
              instance: inst,
            };
          }

          return { ...tmpl, instance: inst };
        })
        .filter(Boolean)
        .sort((a, b) => a!.order - b!.order) as PhaseComputed['tasks'];

      const completed = phaseTasks.filter(
        (t) => t.instance.status === 'completed' || t.instance.status === 'skipped',
      ).length;

      return {
        phase,
        status: statuses.get(phase.id) ?? 'locked',
        progress: { completed, total: phaseTasks.length },
        tasks: phaseTasks,
      };
    });
}

function computeOverallProgress(
  workflow: OnboardingWorkflow,
  applicableTaskIds?: Set<string>,
) {
  const active = workflow.tasks.filter((t) => {
    if (applicableTaskIds && !applicableTaskIds.has(t.taskTemplateId)) {
      return false;
    }
    return t.status !== 'skipped';
  });
  const done = active.filter((t) => t.status === 'completed');
  return {
    completed: done.length,
    total: active.length,
    percentage: active.length > 0 ? Math.round((done.length / active.length) * 100) : 0,
  };
}

function deriveWorkflowStatus(
  workflow: OnboardingWorkflow,
  applicableTaskIds?: Set<string>,
): OnboardingWorkflowStatus {
  const active = workflow.tasks.filter((t) => {
    if (applicableTaskIds && !applicableTaskIds.has(t.taskTemplateId)) {
      return false;
    }
    return t.status !== 'skipped';
  });

  if (active.length === 0) return 'not_started';
  if (active.every((t) => t.status === 'completed')) return 'completed';
  if (active.some((t) => t.status !== 'pending')) return 'in_progress';
  return 'not_started';
}

// ---------------------------------------------------------------------------
// Mock CRUD operations
// ---------------------------------------------------------------------------

async function fetchWorkflowMock(employeeId: string): Promise<OnboardingWorkflow | null> {
  return getWorkflowFromStorageOrSeed(employeeId);
}

async function fetchLatestProvisioningJobMock(
  employeeId: string,
): Promise<ProvisioningJobSnapshot | null> {
  return getProvisioningJobFromStorageOrSeed(employeeId);
}

async function fetchLatestProvisioningJobRemote(
  employeeId: string,
): Promise<ProvisioningJobSnapshot | null> {
  if (!supabase) {
    throw new Error('Supabase client is unavailable.');
  }

  const { data, error } = await supabase
    .from('provisioning_jobs')
    .select('id, status, retry_count')
    .eq('employee_id', employeeId)
    .eq('service', 'M365')
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle<ProvisioningJobRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    jobId: data.id,
    status: data.status,
    retryCount: data.retry_count || 0,
  };
}

type WorkflowRow = {
  id: string;
  employee_id: string;
  status: OnboardingWorkflowStatus;
  created_at: string;
  updated_at: string;
};

type WorkflowTaskRow = {
  task_template_id: string;
  status: OnboardingTaskStatus;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
};

async function fetchWorkflowRemote(employeeId: string): Promise<OnboardingWorkflow | null> {
  if (!supabase) {
    throw new Error('Supabase client is unavailable.');
  }

  const { data: workflowRow, error: workflowError } = await supabase
    .from('onboarding_workflows')
    .select('id, employee_id, status, created_at, updated_at')
    .eq('employee_id', employeeId)
    .maybeSingle<WorkflowRow>();

  if (workflowError) {
    throw new Error(workflowError.message);
  }

  if (!workflowRow) {
    return null;
  }

  const { data: taskRows, error: taskError } = await supabase
    .from('onboarding_workflow_tasks')
    .select('task_template_id, status, completed_at, completed_by, notes')
    .eq('workflow_id', workflowRow.id);

  if (taskError) {
    throw new Error(taskError.message);
  }

  return {
    id: workflowRow.id,
    employeeId: workflowRow.employee_id,
    status: workflowRow.status,
    createdAt: workflowRow.created_at,
    updatedAt: workflowRow.updated_at,
    tasks: ((taskRows || []) as WorkflowTaskRow[]).map((task) => ({
      taskTemplateId: task.task_template_id,
      status: task.status,
      completedAt: task.completed_at || undefined,
      completedBy: task.completed_by || undefined,
      notes: task.notes || undefined,
    })),
  };
}

async function initializeOnboardingMock(
  employeeId: string,
  department: string,
  provisioningStatus?: 'completed' | 'running' | 'failed',
): Promise<OnboardingWorkflow> {
  const existing = getStoredWorkflow(employeeId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const workflow: OnboardingWorkflow = {
    id: `ob-${Date.now()}`,
    employeeId,
    status: 'not_started',
    tasks: buildInitialTasks(department, provisioningStatus),
    createdAt: now,
    updatedAt: now,
  };

  workflow.status = deriveWorkflowStatus(workflow, getApplicableTaskIdSet(department));

  setStoredWorkflow(workflow);
  return workflow;
}

async function toggleTaskMock(
  employeeId: string,
  taskTemplateId: string,
  department: string,
): Promise<void> {
  const workflow = getWorkflowFromStorageOrSeed(employeeId);
  if (!workflow) throw new Error('Onboarding workflow not found.');

  const applicableTaskIds = getApplicableTaskIdSet(department);
  assertTaskCanBeUpdated(workflow, taskTemplateId, department, applicableTaskIds);

  const task = workflow.tasks.find((t) => t.taskTemplateId === taskTemplateId);
  if (!task) throw new Error('Task not found in workflow.');

  if (task.status === 'completed') {
    task.status = 'pending';
    task.completedAt = undefined;
    task.completedBy = undefined;
  } else {
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.completedBy = 'HR Admin';
  }

  workflow.status = deriveWorkflowStatus(workflow, applicableTaskIds);
  setStoredWorkflow(workflow);
}

async function setTaskStatusMock(
  employeeId: string,
  taskTemplateId: string,
  status: OnboardingTaskStatus,
  department: string,
): Promise<void> {
  const workflow = getWorkflowFromStorageOrSeed(employeeId);
  if (!workflow) throw new Error('Onboarding workflow not found.');

  const applicableTaskIds = getApplicableTaskIdSet(department);
  assertTaskCanBeUpdated(workflow, taskTemplateId, department, applicableTaskIds);

  const task = workflow.tasks.find((t) => t.taskTemplateId === taskTemplateId);
  if (!task) throw new Error('Task not found in workflow.');

  task.status = status;
  if (status === 'completed') {
    task.completedAt = new Date().toISOString();
    task.completedBy = 'HR Admin';
  } else {
    task.completedAt = undefined;
    task.completedBy = undefined;
  }

  workflow.status = deriveWorkflowStatus(workflow, applicableTaskIds);
  setStoredWorkflow(workflow);
}

async function addTaskNoteMock(
  employeeId: string,
  taskTemplateId: string,
  note: string,
): Promise<void> {
  const workflow = getWorkflowFromStorageOrSeed(employeeId);
  if (!workflow) throw new Error('Onboarding workflow not found.');

  const task = workflow.tasks.find((t) => t.taskTemplateId === taskTemplateId);
  if (!task) throw new Error('Task not found in workflow.');

  task.notes = note;
  setStoredWorkflow(workflow);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface InitializeOnboardingInput {
  employeeId: string;
  department: string;
  provisioningStatus?: 'completed' | 'running' | 'failed';
}

export const useOnboarding = (employeeId: string, department: string) => {
  const queryClient = useQueryClient();
  const queryKey = [QUERY_KEY_PREFIX, employeeId];
  const provisioningQueryKey = [PROVISIONING_QUERY_KEY_PREFIX, employeeId];

  const workflowQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (isSupabaseConfigured && supabase) {
        return fetchWorkflowRemote(employeeId);
      }
      return fetchWorkflowMock(employeeId);
    },
    staleTime: 10_000,
    enabled: !!employeeId,
  });

  const provisioningJobQuery = useQuery({
    queryKey: provisioningQueryKey,
    queryFn: async () => {
      try {
        if (isSupabaseConfigured && supabase) {
          return await fetchLatestProvisioningJobRemote(employeeId);
        }
        return await fetchLatestProvisioningJobMock(employeeId);
      } catch (error) {
        console.error('Failed to fetch latest provisioning job:', error);
        return null;
      }
    },
    enabled: !!employeeId,
    staleTime: 5_000,
    refetchInterval: (query) => {
      const data = query.state.data as ProvisioningJobSnapshot | null | undefined;
      if (data?.status === 'Queued' || data?.status === 'Running') {
        return 4_000;
      }
      return false;
    },
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey: provisioningQueryKey });
  };

  // Computed state
  const latestProvisioningJob = provisioningJobQuery.data ?? null;
  const provisioningStatusOverride = mapProvisioningJobStatusToTaskStatus(
    latestProvisioningJob?.status,
  );
  const applicableTaskIds = getApplicableTaskIdSet(department);
  const rawWorkflow = workflowQuery.data ?? null;
  const workflow = rawWorkflow
    ? {
        ...rawWorkflow,
        tasks: applyProvisioningTaskStatusOverride(rawWorkflow.tasks, provisioningStatusOverride),
      }
    : null;

  if (workflow) {
    workflow.status = deriveWorkflowStatus(workflow, applicableTaskIds);
  }

  const phases = workflow
    ? buildPhaseComputedList(workflow, department, latestProvisioningJob?.status, applicableTaskIds)
    : [];
  const overall = workflow
    ? computeOverallProgress(workflow, applicableTaskIds)
    : { completed: 0, total: 0, percentage: 0 };

  const assertTaskIsUnlocked = (taskTemplateId: string) => {
    if (!workflow) {
      throw new Error('Onboarding workflow not found.');
    }

    assertTaskCanBeUpdated(workflow, taskTemplateId, department, applicableTaskIds);
  };

  // Mutations
  const initializeMutation = useMutation({
    mutationFn: async (input: InitializeOnboardingInput) => {
      if (isSupabaseConfigured && supabase) {
        await initializeOnboardingWorkflow({
          employeeId: input.employeeId,
          provisioningStatus: input.provisioningStatus,
        });

        const workflow = await fetchWorkflowRemote(input.employeeId);
        if (!workflow) {
          throw new Error('Onboarding workflow could not be loaded after initialization.');
        }

        return workflow;
      }

      return initializeOnboardingMock(
        input.employeeId,
        input.department,
        input.provisioningStatus,
      );
    },
    onSuccess: () => void invalidate(),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (taskTemplateId: string) => {
      assertTaskIsUnlocked(taskTemplateId);

      if (isSupabaseConfigured && supabase) {
        await updateOnboardingTask({
          employeeId,
          taskTemplateId,
          toggleCompleted: true,
        });
        return;
      }

      await toggleTaskMock(employeeId, taskTemplateId, department);
    },
    onSuccess: () => void invalidate(),
  });

  const setTaskStatusMutation = useMutation({
    mutationFn: async ({ taskTemplateId, status }: { taskTemplateId: string; status: OnboardingTaskStatus }) => {
      assertTaskIsUnlocked(taskTemplateId);

      if (isSupabaseConfigured && supabase) {
        await updateOnboardingTask({
          employeeId,
          taskTemplateId,
          status,
        });
        return;
      }

      await setTaskStatusMock(employeeId, taskTemplateId, status, department);
    },
    onSuccess: () => void invalidate(),
  });

  const addTaskNoteMutation = useMutation({
    mutationFn: async ({ taskTemplateId, note }: { taskTemplateId: string; note: string }) => {
      if (isSupabaseConfigured && supabase) {
        await updateOnboardingTask({
          employeeId,
          taskTemplateId,
          note,
        });
        return;
      }

      await addTaskNoteMock(employeeId, taskTemplateId, note);
    },
    onSuccess: () => void invalidate(),
  });

  const triggerProvisioningMutation = useMutation({
    mutationFn: async () => {
      if (isSupabaseConfigured && supabase) {
        const result = await triggerOnboardingAutomation({
          employeeId,
          service: 'M365',
        });

        const status = mapProvisioningJobStatusToTaskStatus(result.status) || 'in_progress';
        await updateOnboardingTask({
          employeeId,
          taskTemplateId: PROVISIONING_TASK_TEMPLATE_ID,
          status,
        });

        return result;
      }

      const activeJob = getProvisioningJobFromStorageOrSeed(employeeId);
      if (activeJob && (activeJob.status === 'Queued' || activeJob.status === 'Running')) {
        await setTaskStatusMock(
          employeeId,
          PROVISIONING_TASK_TEMPLATE_ID,
          'in_progress',
          department,
        );
        return {
          jobId: activeJob.jobId,
          status: activeJob.status,
          reused: true,
        };
      }

      const snapshot: ProvisioningJobSnapshot = {
        jobId: `pj-${Date.now()}`,
        status: 'Running',
        retryCount: activeJob?.retryCount || 0,
      };
      setStoredProvisioningJob(employeeId, snapshot);
      await setTaskStatusMock(
        employeeId,
        PROVISIONING_TASK_TEMPLATE_ID,
        'in_progress',
        department,
      );

      return {
        jobId: snapshot.jobId,
        status: snapshot.status,
        reused: false,
      };
    },
    onSuccess: () => void invalidate(),
  });

  const retryProvisioningMutation = useMutation({
    mutationFn: async () => {
      const failedJobId = latestProvisioningJob?.jobId;
      if (!failedJobId) {
        throw new Error('No failed provisioning job found to retry.');
      }

      if (isSupabaseConfigured && supabase) {
        const result = await retryProvisioningAutomation(failedJobId);
        const status = mapProvisioningJobStatusToTaskStatus(result.status) || 'in_progress';

        await updateOnboardingTask({
          employeeId,
          taskTemplateId: PROVISIONING_TASK_TEMPLATE_ID,
          status,
        });

        return result;
      }

      const snapshot: ProvisioningJobSnapshot = {
        jobId: failedJobId,
        status: 'Running',
        retryCount: (latestProvisioningJob?.retryCount || 0) + 1,
      };
      setStoredProvisioningJob(employeeId, snapshot);
      await setTaskStatusMock(
        employeeId,
        PROVISIONING_TASK_TEMPLATE_ID,
        'in_progress',
        department,
      );

      return {
        jobId: snapshot.jobId,
        status: snapshot.status,
        retryCount: snapshot.retryCount,
      };
    },
    onSuccess: () => void invalidate(),
  });

  return {
    workflow,
    phases,
    overallProgress: overall,
    isLoading: workflowQuery.isLoading,
    isMutating:
      initializeMutation.isPending ||
      toggleTaskMutation.isPending ||
      setTaskStatusMutation.isPending ||
      addTaskNoteMutation.isPending ||
      triggerProvisioningMutation.isPending ||
      retryProvisioningMutation.isPending,
    error:
      workflowQuery.error ||
      initializeMutation.error ||
      toggleTaskMutation.error ||
      setTaskStatusMutation.error ||
      addTaskNoteMutation.error ||
      triggerProvisioningMutation.error ||
      retryProvisioningMutation.error,

    latestProvisioningJob,
    isProvisioningActionPending:
      triggerProvisioningMutation.isPending || retryProvisioningMutation.isPending,

    initializeOnboarding: initializeMutation.mutateAsync,
    toggleTask: toggleTaskMutation.mutateAsync,
    setTaskStatus: setTaskStatusMutation.mutateAsync,
    addTaskNote: addTaskNoteMutation.mutateAsync,
    triggerProvisioning: triggerProvisioningMutation.mutateAsync,
    retryProvisioning: retryProvisioningMutation.mutateAsync,
    refetch: workflowQuery.refetch,
  };
};
