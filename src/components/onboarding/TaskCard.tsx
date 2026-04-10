import { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import type { OnboardingTaskStatus, PhaseComputed, TaskAssignee } from '@/data/onboardingTypes';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import ExternalRequestEmailDialog, { type ExternalRequestEmailContext } from './ExternalRequestEmailDialog';
import InstructionAccordion from './InstructionAccordion';

type PhaseTask = PhaseComputed['tasks'][number];

interface TaskCardProps {
  task: PhaseTask;
  locked: boolean;
  disabled?: boolean;
  provisioningJob?: {
    jobId: string;
    retryCount: number;
  } | null;
  onToggleTask: (taskTemplateId: string) => void | Promise<void>;
  onSetTaskStatus: (input: { taskTemplateId: string; status: OnboardingTaskStatus }) => void | Promise<void>;
  onTriggerProvisioning: () => void | Promise<void>;
  onRetryProvisioning: () => void | Promise<void>;
  requestEmailContext: ExternalRequestEmailContext;
}

const assigneeStyles: Record<TaskAssignee, string> = {
  admin: 'border-blue-200 bg-blue-50 text-blue-700',
  employee: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  horizon3: 'border-slate-200 bg-slate-100 text-slate-700',
  transportplan_admin: 'border-amber-200 bg-amber-50 text-amber-700',
};

const statusStyles: Record<OnboardingTaskStatus, string> = {
  pending: 'border-slate-200 bg-slate-100 text-slate-700',
  in_progress: 'border-blue-200 bg-blue-50 text-blue-700',
  waiting_external: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  skipped: 'border-zinc-200 bg-zinc-100 text-zinc-600',
};

const statusLabelKey: Record<OnboardingTaskStatus, string> = {
  pending: 'onboarding.status.pending',
  in_progress: 'onboarding.status.inProgress',
  waiting_external: 'onboarding.status.waitingExternal',
  completed: 'onboarding.status.completed',
  skipped: 'onboarding.status.skipped',
};

const assigneeLabelKey: Record<TaskAssignee, string> = {
  admin: 'onboarding.assignee.admin',
  employee: 'onboarding.assignee.employee',
  horizon3: 'onboarding.assignee.horizon3',
  transportplan_admin: 'onboarding.assignee.transportplan_admin',
};

export const TaskCard = ({
  task,
  locked,
  disabled = false,
  provisioningJob,
  onToggleTask,
  onSetTaskStatus,
  onTriggerProvisioning,
  onRetryProvisioning,
  requestEmailContext,
}: TaskCardProps) => {
  const { t } = useLanguage();
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

  const isCompleted = task.instance.status === 'completed';
  const isSkipped = task.instance.status === 'skipped';
  const isDisabled = locked || disabled || isSkipped;
  const canGenerateEmail = task.actionType === 'generate_email';
  const canTriggerProvisioning =
    task.actionType === 'trigger_provisioning' && task.instance.status === 'pending';
  const canRetryProvisioning =
    task.actionType === 'retry_provisioning' && task.instance.status === 'pending';
  const isProvisioningTask = task.id === 'provision-cores-m365';

  const handleMarkAsSent = async () => {
    await onSetTaskStatus({
      taskTemplateId: task.id,
      status: 'waiting_external',
    });
  };

  const handleCheckedChange = (value: boolean | 'indeterminate') => {
    if (isDisabled || value === 'indeterminate') {
      return;
    }

    if ((value && !isCompleted) || (!value && isCompleted)) {
      void onToggleTask(task.id);
    }
  };

  const handleProvisioningAction = () => {
    if (canRetryProvisioning) {
      void onRetryProvisioning();
      return;
    }

    if (canTriggerProvisioning) {
      void onTriggerProvisioning();
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        locked && 'cursor-not-allowed opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <Checkbox
            checked={isCompleted}
            onCheckedChange={handleCheckedChange}
            disabled={isDisabled}
            aria-label={t(task.title)}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{t(task.title)}</p>

            <Badge variant="outline" className={cn('text-[10px] font-medium', assigneeStyles[task.assignee])}>
              {t(assigneeLabelKey[task.assignee])}
            </Badge>

            <Badge variant="outline" className={cn('text-[10px] font-medium', statusStyles[task.instance.status])}>
              {t(statusLabelKey[task.instance.status])}
            </Badge>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">{t(task.description)}</p>

          {(canGenerateEmail || canTriggerProvisioning || canRetryProvisioning) && (
            <div className="mt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={canGenerateEmail ? () => setIsEmailDialogOpen(true) : handleProvisioningAction}
                disabled={isDisabled}
                className="h-7 px-2.5 text-xs"
              >
                {canGenerateEmail
                  ? t('onboarding.action.generateEmail')
                  : canRetryProvisioning
                    ? t('onboarding.action.retryProvisioning')
                    : t('onboarding.action.triggerProvisioning')}
              </Button>
            </div>
          )}

          <InstructionAccordion instructions={task.instructions} />

          {isProvisioningTask && provisioningJob && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t('onboarding.jobId')}: {provisioningJob.jobId} • {t('onboarding.retryCount')}: {provisioningJob.retryCount}
            </p>
          )}

          {task.instance.completedAt && (
            <p className="mt-2 text-[11px] text-muted-foreground">{task.instance.completedAt}</p>
          )}
        </div>

        <div className="pt-0.5">
          {isCompleted ? (
            <CheckCircle2 size={16} className="text-emerald-500" />
          ) : (
            <Circle size={16} className="text-muted-foreground/40" />
          )}
        </div>
      </div>

      {canGenerateEmail && (
        <ExternalRequestEmailDialog
          open={isEmailDialogOpen}
          onOpenChange={setIsEmailDialogOpen}
          taskId={task.id}
          context={requestEmailContext}
          disabled={isDisabled}
          onMarkAsSent={handleMarkAsSent}
        />
      )}
    </div>
  );
};

export default TaskCard;
