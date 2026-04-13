import { useEffect, useMemo, useRef } from 'react';
import { ArrowRight, Hourglass } from 'lucide-react';
import type { Employee, ProvisioningStatus } from '@/data/mockData';
import type { OnboardingPhaseStatus, PhaseComputed } from '@/data/onboardingTypes';
import { useAuth } from '@/contexts/AuthContext';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { createAppNotification } from '@/lib/notifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import OnboardingTimeline from './OnboardingTimeline';
import CompletionCard from './CompletionCard.tsx';

interface OnboardingTabProps {
  employee: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'email' | 'department' | 'startDate' | 'provisioningStatus'>;
}

const workflowStatusLabelKey = {
  not_started: 'onboarding.status.pending',
  in_progress: 'onboarding.status.inProgress',
  completed: 'onboarding.status.completed',
} as const;

const workflowStatusStyles = {
  not_started: 'border-slate-200 bg-slate-100 text-slate-700',
  in_progress: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
} as const;

const phaseSegmentStyles: Record<OnboardingPhaseStatus, string> = {
  locked: 'bg-slate-300/80',
  available: 'bg-blue-400/80',
  in_progress: 'bg-indigo-500',
  waiting: 'bg-amber-500',
  completed: 'bg-emerald-500',
};

type NextAction = {
  phase: PhaseComputed;
  task: PhaseComputed['tasks'][number];
  isWaiting: boolean;
};

function getNextAction(phases: PhaseComputed[]): NextAction | null {
  for (const phase of phases) {
    if (phase.status === 'locked') {
      continue;
    }

    const actionableTask = phase.tasks.find(
      (task) => task.instance.status === 'pending' || task.instance.status === 'in_progress',
    );

    if (actionableTask) {
      return {
        phase,
        task: actionableTask,
        isWaiting: false,
      };
    }
  }

  for (const phase of phases) {
    if (phase.status === 'locked') {
      continue;
    }

    const waitingTask = phase.tasks.find((task) => task.instance.status === 'waiting_external');
    if (waitingTask) {
      return {
        phase,
        task: waitingTask,
        isWaiting: true,
      };
    }
  }

  return null;
}

function mapProvisioningStatus(status: ProvisioningStatus): 'completed' | 'running' | 'failed' | undefined {
  if (status === 'Provisioned') return 'completed';
  if (status === 'Pending') return 'running';
  if (status === 'Failed') return 'failed';
  return undefined;
}

export const OnboardingTab = ({ employee }: OnboardingTabProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const previousPhaseStatusesRef = useRef<Record<string, OnboardingPhaseStatus> | null>(null);
  const previousWorkflowStatusRef = useRef<'not_started' | 'in_progress' | 'completed' | null>(null);
  const {
    workflow,
    phases,
    overallProgress,
    latestProvisioningJob,
    isLoading,
    isMutating,
    error,
    initializeOnboarding,
    retryProvisioning,
    triggerProvisioning,
    toggleTask,
    setTaskStatus,
  } = useOnboarding(employee.id, employee.department);

  const employeeName = `${employee.firstName} ${employee.lastName}`;
  const onboardingLink = `/employees/${employee.id}?tab=onboarding`;

  const requestEmailContext = useMemo(
    () => ({
      employeeName,
      employeeEmail: employee.email || `${employee.firstName.toLowerCase()}.${employee.lastName.toLowerCase()}@cores.nl`,
      department: employee.department,
      startDate: employee.startDate,
      adminName: user?.name || 'HR Admin',
      adminEmail: user?.email || 'admin@cores.nl',
    }),
    [employee, employeeName, user],
  );

  const completionDate = useMemo(() => {
    if (!workflow) {
      return undefined;
    }

    const markCompleteTask = workflow.tasks.find((task) => task.taskTemplateId === 'mark-complete');
    if (markCompleteTask?.completedAt) {
      return markCompleteTask.completedAt;
    }

    const completedDates = workflow.tasks
      .map((task) => task.completedAt)
      .filter((value): value is string => Boolean(value));

    if (completedDates.length === 0) {
      return undefined;
    }

    return completedDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [workflow]);

  const elapsedDays = useMemo(() => {
    const startDate = new Date(employee.startDate);
    if (Number.isNaN(startDate.getTime())) {
      return null;
    }

    const endDate =
      workflow?.status === 'completed' && completionDate
        ? new Date(completionDate)
        : new Date();

    const milliseconds = endDate.getTime() - startDate.getTime();
    const dayCount = Math.floor(milliseconds / (1000 * 60 * 60 * 24));

    return Math.max(0, dayCount);
  }, [completionDate, employee.startDate, workflow?.status]);

  const nextAction = useMemo(() => getNextAction(phases), [phases]);

  useEffect(() => {
    if (!workflow || phases.length === 0) {
      return;
    }

    const currentPhaseStatuses = phases.reduce<Record<string, OnboardingPhaseStatus>>(
      (acc, phase) => {
        acc[phase.phase.id] = phase.status;
        return acc;
      },
      {},
    );

    if (!previousPhaseStatusesRef.current || !previousWorkflowStatusRef.current) {
      previousPhaseStatusesRef.current = currentPhaseStatuses;
      previousWorkflowStatusRef.current = workflow.status;
      return;
    }

    const previousPhaseStatuses = previousPhaseStatusesRef.current;
    for (const phase of phases) {
      const previousStatus = previousPhaseStatuses[phase.phase.id];
      if (previousStatus !== 'completed' && phase.status === 'completed') {
        void createAppNotification({
          title: t('onboarding.notification.phaseCompletedTitle'),
          description: t('onboarding.notification.phaseCompletedDescription')
            .replace('{phase}', t(phase.phase.title))
            .replace('{name}', employeeName),
          type: 'success',
          link: onboardingLink,
          payload: {
            employeeId: employee.id,
            phaseId: phase.phase.id,
            event: 'phase_completed',
          },
        });
      }
    }

    if (previousWorkflowStatusRef.current !== 'completed' && workflow.status === 'completed') {
      void createAppNotification({
        title: t('onboarding.notification.workflowCompletedTitle'),
        description: t('onboarding.notification.workflowCompletedDescription').replace('{name}', employeeName),
        type: 'success',
        link: onboardingLink,
        payload: {
          employeeId: employee.id,
          event: 'workflow_completed',
        },
      });
    }

    previousPhaseStatusesRef.current = currentPhaseStatuses;
    previousWorkflowStatusRef.current = workflow.status;
  }, [employee.id, employeeName, onboardingLink, phases, t, workflow]);

  const handleInitialize = async () => {
    try {
      await initializeOnboarding({
        employeeId: employee.id,
        department: employee.department,
        provisioningStatus: mapProvisioningStatus(employee.provisioningStatus),
      });
    } catch (initError) {
      const message = initError instanceof Error
        ? initError.message
        : t('onboarding.workflow.errorDescription');

      toast({
        title: t('onboarding.workflow.errorTitle'),
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleTriggerProvisioning = async () => {
    try {
      const result = await triggerProvisioning();

      toast({
        title: t('onboarding.action.triggerProvisioning'),
        description: result.reused
          ? t('onboarding.provisioning.triggerReused')
          : `${t('onboarding.provisioning.triggerSuccess')} (${t('onboarding.jobId')}: ${result.jobId})`,
      });
    } catch (actionError) {
      const message = actionError instanceof Error
        ? actionError.message
        : t('onboarding.provisioning.actionError');

      toast({
        title: t('onboarding.action.triggerProvisioning'),
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleRetryProvisioning = async () => {
    try {
      const result = await retryProvisioning();

      toast({
        title: t('onboarding.action.retryProvisioning'),
        description: `${t('onboarding.provisioning.retrySuccess')} #${result.retryCount}`,
      });
    } catch (actionError) {
      const message = actionError instanceof Error
        ? actionError.message
        : t('onboarding.provisioning.actionError');

      toast({
        title: t('onboarding.action.retryProvisioning'),
        description: message,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-destructive">{t('onboarding.workflow.errorTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : t('onboarding.workflow.errorDescription')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!workflow) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{t('onboarding.workflow.emptyTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('onboarding.workflow.emptyDescription')}</p>
          </div>

          <div>
            <Button onClick={() => void handleInitialize()} disabled={isMutating}>
              {isMutating ? t('onboarding.workflow.initializing') : t('onboarding.workflow.initialize')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('onboarding.progress.title')}
              </p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {overallProgress.percentage}%
              </p>
              <p className="text-xs text-muted-foreground">
                {overallProgress.completed}/{overallProgress.total} {t('onboarding.tasks').toLowerCase()}
              </p>
              {elapsedDays !== null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('onboarding.daysSinceStart')}: {elapsedDays}
                </p>
              )}
            </div>

            <Badge
              variant="outline"
              className={cn(
                'text-xs font-medium',
                workflowStatusStyles[workflow.status],
              )}
            >
              {t(workflowStatusLabelKey[workflow.status])}
            </Badge>
          </div>

          <div className="flex h-2 gap-1">
            {phases.map((phase) => (
              <span
                key={phase.phase.id}
                className={cn('flex-1 rounded-full', phaseSegmentStyles[phase.status])}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {nextAction && (
        <Card
          className={cn(
            'border-0 shadow-sm',
            nextAction.isWaiting
              ? 'bg-amber-50/70 text-amber-900'
              : 'bg-blue-50/70 text-blue-900',
          )}
        >
          <CardContent className="flex items-start gap-3 p-3">
            <span
              className={cn(
                'mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md',
                nextAction.isWaiting
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700',
              )}
            >
              {nextAction.isWaiting ? <Hourglass size={16} /> : <ArrowRight size={16} />}
            </span>

            <div className="min-w-0">
              <p
                className={cn(
                  'text-[11px] font-semibold uppercase tracking-wide',
                  nextAction.isWaiting ? 'text-amber-700' : 'text-blue-700',
                )}
              >
                {nextAction.isWaiting
                  ? t('onboarding.next.waitingOn')
                  : t('onboarding.next.upNext')}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {t(nextAction.task.title)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(nextAction.phase.phase.title)} • {nextAction.phase.progress.completed}/{nextAction.phase.progress.total}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <OnboardingTimeline
        phases={phases}
        disabled={isMutating}
        provisioningJob={latestProvisioningJob}
        onToggleTask={toggleTask}
        onSetTaskStatus={setTaskStatus}
        onTriggerProvisioning={handleTriggerProvisioning}
        onRetryProvisioning={handleRetryProvisioning}
        requestEmailContext={requestEmailContext}
      />

      {workflow.status === 'completed' && (
        <CompletionCard
          employeeName={employeeName}
          completedAt={completionDate}
          completedTasks={overallProgress.completed}
          totalTasks={overallProgress.total}
        />
      )}
    </div>
  );
};

export default OnboardingTab;
