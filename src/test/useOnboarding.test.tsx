import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ONBOARDING_TASKS } from '@/data/onboardingTemplate';
import type { OnboardingTaskInstance, OnboardingWorkflow } from '@/data/onboardingTypes';
import { useOnboarding } from '@/hooks/useOnboarding';

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const CONDITIONAL_TRANSPORT_TASK_IDS = [
  'request-transportplan',
  'install-windows-app',
  'login-transportplan-cloud',
  'verify-transportplan',
  'verify-windows-app',
];

const VERIFICATION_TASK_IDS = ONBOARDING_TASKS
  .filter((template) => template.phaseId === 'verification')
  .map((template) => template.id);

function buildWorkflowWithPendingTasks(
  employeeId: string,
  pendingTaskIds: string[],
): OnboardingWorkflow {
  const pendingSet = new Set(pendingTaskIds);

  const tasks: OnboardingTaskInstance[] = ONBOARDING_TASKS.map((template) => {
    const pending = pendingSet.has(template.id);

    return {
      taskTemplateId: template.id,
      status: pending ? 'pending' : 'completed',
      completedAt: pending ? undefined : '2026-04-10T10:00:00.000Z',
      completedBy: pending ? undefined : 'HR Admin',
    };
  });

  return {
    id: `ob-test-${employeeId}`,
    employeeId,
    status: 'in_progress',
    tasks,
    createdAt: '2026-04-10T09:00:00.000Z',
    updatedAt: '2026-04-10T09:00:00.000Z',
  };
}

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('filters out transport-only tasks and phase for non-transport departments', async () => {
    const employeeId = 'emp-test-sales';
    const { result } = renderHook(() => useOnboarding(employeeId, 'Sales'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.initializeOnboarding({
        employeeId,
        department: 'Sales',
      });
    });

    await waitFor(() => {
      expect(result.current.workflow).not.toBeNull();
    });

    const taskIds = new Set(result.current.workflow?.tasks.map((task) => task.taskTemplateId));
    for (const taskId of CONDITIONAL_TRANSPORT_TASK_IDS) {
      expect(taskIds.has(taskId)).toBe(false);
    }

    const phaseIds = result.current.phases.map((phase) => phase.phase.id);
    expect(phaseIds).not.toContain('transportplan-setup');

    const verificationPhase = result.current.phases.find((phase) => phase.phase.id === 'verification');
    const verificationTaskIds = verificationPhase?.tasks.map((task) => task.id) || [];
    expect(verificationTaskIds).not.toContain('verify-transportplan');
    expect(verificationTaskIds).not.toContain('verify-windows-app');
  });

  it('includes transport tasks and phase for transport departments', async () => {
    const employeeId = 'emp-test-transport';
    const { result } = renderHook(() => useOnboarding(employeeId, 'Transport'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.initializeOnboarding({
        employeeId,
        department: 'Transport',
      });
    });

    await waitFor(() => {
      expect(result.current.workflow).not.toBeNull();
    });

    const taskIds = new Set(result.current.workflow?.tasks.map((task) => task.taskTemplateId));
    expect(taskIds.has('request-transportplan')).toBe(true);
    expect(taskIds.has('install-windows-app')).toBe(true);
    expect(taskIds.has('login-transportplan-cloud')).toBe(true);
    expect(taskIds.has('verify-transportplan')).toBe(true);
    expect(taskIds.has('verify-windows-app')).toBe(true);

    const phaseIds = result.current.phases.map((phase) => phase.phase.id);
    expect(phaseIds).toContain('transportplan-setup');
  });

  it('ignores stale non-applicable transport tasks when deriving sales progress and status', async () => {
    const employeeId = 'emp-test-stale-sales';

    const tasks: OnboardingTaskInstance[] = ONBOARDING_TASKS.map((template) => ({
      taskTemplateId: template.id,
      status: CONDITIONAL_TRANSPORT_TASK_IDS.includes(template.id) ? 'pending' : 'completed',
      completedAt: CONDITIONAL_TRANSPORT_TASK_IDS.includes(template.id)
        ? undefined
        : '2026-04-10T10:00:00.000Z',
      completedBy: CONDITIONAL_TRANSPORT_TASK_IDS.includes(template.id)
        ? undefined
        : 'HR Admin',
    }));

    const staleWorkflow: OnboardingWorkflow = {
      id: 'ob-test-stale-sales',
      employeeId,
      status: 'in_progress',
      tasks,
      createdAt: '2026-04-10T09:00:00.000Z',
      updatedAt: '2026-04-10T09:00:00.000Z',
    };

    localStorage.setItem(`cores:onboarding:${employeeId}`, JSON.stringify(staleWorkflow));

    const { result } = renderHook(() => useOnboarding(employeeId, 'Sales'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.workflow?.status).toBe('completed');
    expect(result.current.overallProgress.completed).toBe(result.current.overallProgress.total);

    const phaseIds = result.current.phases.map((phase) => phase.phase.id);
    expect(phaseIds).not.toContain('transportplan-setup');

    const verificationPhase = result.current.phases.find((phase) => phase.phase.id === 'verification');
    const verificationTaskIds = verificationPhase?.tasks.map((task) => task.id) || [];
    expect(verificationTaskIds).not.toContain('verify-transportplan');
    expect(verificationTaskIds).not.toContain('verify-windows-app');
  });

  it('unlocks verification for sales when employee-setup, system-activation, and instructions-delivery are done', async () => {
    const employeeId = 'emp-test-step9-sales-unlock';
    const pendingTaskIds = [
      ...VERIFICATION_TASK_IDS,
      'mark-complete',
      ...CONDITIONAL_TRANSPORT_TASK_IDS,
    ];

    const seededWorkflow = buildWorkflowWithPendingTasks(employeeId, pendingTaskIds);
    localStorage.setItem(`cores:onboarding:${employeeId}`, JSON.stringify(seededWorkflow));

    const { result } = renderHook(() => useOnboarding(employeeId, 'Sales'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const verificationPhase = result.current.phases.find((phase) => phase.phase.id === 'verification');
    expect(verificationPhase?.status).toBe('available');
  });

  it('keeps verification locked for transport until transportplan setup is complete', async () => {
    const employeeId = 'emp-test-step9-transport-locked';
    const pendingTaskIds = [
      ...VERIFICATION_TASK_IDS,
      'mark-complete',
      'install-windows-app',
      'login-transportplan-cloud',
    ];

    const seededWorkflow = buildWorkflowWithPendingTasks(employeeId, pendingTaskIds);
    localStorage.setItem(`cores:onboarding:${employeeId}`, JSON.stringify(seededWorkflow));

    const { result } = renderHook(() => useOnboarding(employeeId, 'Transport'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const verificationPhase = result.current.phases.find((phase) => phase.phase.id === 'verification');
    expect(verificationPhase?.status).toBe('locked');
  });

  it('unlocks verification for transport after transportplan setup is complete', async () => {
    const employeeId = 'emp-test-step9-transport-unlock';
    const pendingTaskIds = [...VERIFICATION_TASK_IDS, 'mark-complete'];

    const seededWorkflow = buildWorkflowWithPendingTasks(employeeId, pendingTaskIds);
    localStorage.setItem(`cores:onboarding:${employeeId}`, JSON.stringify(seededWorkflow));

    const { result } = renderHook(() => useOnboarding(employeeId, 'Transport'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const verificationPhase = result.current.phases.find((phase) => phase.phase.id === 'verification');
    expect(verificationPhase?.status).toBe('available');
  });

  it('rejects toggling verification tasks while verification phase is locked', async () => {
    const employeeId = 'emp-test-step9-mutation-lock';
    const pendingTaskIds = [
      ...VERIFICATION_TASK_IDS,
      'mark-complete',
      'install-windows-app',
      'login-transportplan-cloud',
    ];

    const seededWorkflow = buildWorkflowWithPendingTasks(employeeId, pendingTaskIds);
    localStorage.setItem(`cores:onboarding:${employeeId}`, JSON.stringify(seededWorkflow));

    const { result } = renderHook(() => useOnboarding(employeeId, 'Transport'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await expect(result.current.toggleTask('verify-horizon3-m365')).rejects.toThrow(/locked/i);
    });

    const verificationTask = result.current.workflow?.tasks.find(
      (task) => task.taskTemplateId === 'verify-horizon3-m365',
    );
    expect(verificationTask?.status).toBe('pending');
  });
});