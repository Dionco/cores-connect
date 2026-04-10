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

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const QUERY_KEY_PREFIX = 'onboarding';
const MOCK_STORAGE_KEY = 'cores:onboarding';

function storageKeyFor(employeeId: string) {
  return `${MOCK_STORAGE_KEY}:${employeeId}`;
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

/** Determine the status of a single phase based on its task instances. */
function computeSinglePhaseStatus(
  phaseId: string,
  tasks: OnboardingTaskInstance[],
  allPhaseStatuses: Map<string, OnboardingPhaseStatus>,
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
    return tmpl?.phaseId === phaseId;
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
    result.set(phase.id, computeSinglePhaseStatus(phase.id, tasks, result));
  }

  return result;
}

/** Build the full computed view for the UI. */
function buildPhaseComputedList(
  workflow: OnboardingWorkflow,
  department: string,
): PhaseComputed[] {
  const statuses = computeAllPhaseStatuses(workflow.tasks, department);

  return ONBOARDING_PHASES
    .filter((phase) => isPhaseApplicable(phase.id, department))
    .sort((a, b) => a.order - b.order)
    .map((phase) => {
      const phaseTasks = workflow.tasks
        .map((inst) => {
          const tmpl = ONBOARDING_TASKS.find((t) => t.id === inst.taskTemplateId);
          if (!tmpl || tmpl.phaseId !== phase.id) return null;
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

function computeOverallProgress(workflow: OnboardingWorkflow) {
  const active = workflow.tasks.filter((t) => t.status !== 'skipped');
  const done = active.filter((t) => t.status === 'completed');
  return {
    completed: done.length,
    total: active.length,
    percentage: active.length > 0 ? Math.round((done.length / active.length) * 100) : 0,
  };
}

function deriveWorkflowStatus(workflow: OnboardingWorkflow): OnboardingWorkflowStatus {
  const active = workflow.tasks.filter((t) => t.status !== 'skipped');
  if (active.every((t) => t.status === 'completed')) return 'completed';
  if (active.some((t) => t.status !== 'pending')) return 'in_progress';
  return 'not_started';
}

// ---------------------------------------------------------------------------
// Mock CRUD operations
// ---------------------------------------------------------------------------

async function fetchWorkflowMock(employeeId: string): Promise<OnboardingWorkflow | null> {
  return getStoredWorkflow(employeeId);
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
    status: 'in_progress',
    tasks: buildInitialTasks(department, provisioningStatus),
    createdAt: now,
    updatedAt: now,
  };

  setStoredWorkflow(workflow);
  return workflow;
}

async function toggleTaskMock(
  employeeId: string,
  taskTemplateId: string,
): Promise<void> {
  const workflow = getStoredWorkflow(employeeId);
  if (!workflow) throw new Error('Onboarding workflow not found.');

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

  workflow.status = deriveWorkflowStatus(workflow);
  setStoredWorkflow(workflow);
}

async function setTaskStatusMock(
  employeeId: string,
  taskTemplateId: string,
  status: OnboardingTaskStatus,
): Promise<void> {
  const workflow = getStoredWorkflow(employeeId);
  if (!workflow) throw new Error('Onboarding workflow not found.');

  const task = workflow.tasks.find((t) => t.taskTemplateId === taskTemplateId);
  if (!task) throw new Error('Task not found in workflow.');

  task.status = status;
  if (status === 'completed') {
    task.completedAt = new Date().toISOString();
    task.completedBy = 'HR Admin';
  }

  workflow.status = deriveWorkflowStatus(workflow);
  setStoredWorkflow(workflow);
}

async function addTaskNoteMock(
  employeeId: string,
  taskTemplateId: string,
  note: string,
): Promise<void> {
  const workflow = getStoredWorkflow(employeeId);
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

  const workflowQuery = useQuery({
    queryKey,
    queryFn: () => fetchWorkflowMock(employeeId),
    staleTime: 10_000,
    enabled: !!employeeId,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey });
  };

  // Computed state
  const workflow = workflowQuery.data ?? null;
  const phases = workflow ? buildPhaseComputedList(workflow, department) : [];
  const overall = workflow
    ? computeOverallProgress(workflow)
    : { completed: 0, total: 0, percentage: 0 };

  // Mutations
  const initializeMutation = useMutation({
    mutationFn: async (input: InitializeOnboardingInput) => {
      return initializeOnboardingMock(input.employeeId, input.department, input.provisioningStatus);
    },
    onSuccess: () => void invalidate(),
  });

  const toggleTaskMutation = useMutation({
    mutationFn: async (taskTemplateId: string) => {
      await toggleTaskMock(employeeId, taskTemplateId);
    },
    onSuccess: () => void invalidate(),
  });

  const setTaskStatusMutation = useMutation({
    mutationFn: async ({ taskTemplateId, status }: { taskTemplateId: string; status: OnboardingTaskStatus }) => {
      await setTaskStatusMock(employeeId, taskTemplateId, status);
    },
    onSuccess: () => void invalidate(),
  });

  const addTaskNoteMutation = useMutation({
    mutationFn: async ({ taskTemplateId, note }: { taskTemplateId: string; note: string }) => {
      await addTaskNoteMock(employeeId, taskTemplateId, note);
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
      addTaskNoteMutation.isPending,
    error:
      workflowQuery.error ||
      initializeMutation.error ||
      toggleTaskMutation.error ||
      setTaskStatusMutation.error ||
      addTaskNoteMutation.error,

    initializeOnboarding: initializeMutation.mutateAsync,
    toggleTask: toggleTaskMutation.mutateAsync,
    setTaskStatus: setTaskStatusMutation.mutateAsync,
    addTaskNote: addTaskNoteMutation.mutateAsync,
    refetch: workflowQuery.refetch,
  };
};
