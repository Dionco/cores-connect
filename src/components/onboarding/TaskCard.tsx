import { useState } from 'react';
import { BookOpen, Check, Hourglass, Mail, RotateCcw, Zap } from 'lucide-react';
import type { OnboardingTaskStatus, PhaseComputed, TaskAssignee } from '@/data/onboardingTypes';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ExternalRequestEmailDialog, { type ExternalRequestEmailContext } from './ExternalRequestEmailDialog';

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
  admin: 'bg-blue-100/70 text-blue-700',
  employee: 'bg-emerald-100/70 text-emerald-700',
  horizon3: 'bg-slate-200/80 text-slate-700',
  transportplan_admin: 'bg-amber-100/80 text-amber-700',
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
  const { language, t } = useLanguage();
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const isCompleted = task.instance.status === 'completed';
  const isSkipped = task.instance.status === 'skipped';
  const isWaiting = task.instance.status === 'waiting_external';
  const isDisabled = locked || disabled || isSkipped;
  const canGenerateEmail = task.actionType === 'generate_email' && !isCompleted;
  const canTriggerProvisioning =
    task.actionType === 'trigger_provisioning' && task.instance.status === 'pending';
  const canRetryProvisioning =
    task.actionType === 'retry_provisioning' && task.instance.status === 'pending';
  const hasInstructions = Boolean(task.instructions && task.instructions.steps.length > 0);
  const isProvisioningTask = task.id === 'provision-cores-m365';

  const handleMarkAsSent = async () => {
    await onSetTaskStatus({
      taskTemplateId: task.id,
      status: 'waiting_external',
    });
  };

  const handleToggle = () => {
    if (isDisabled) {
      return;
    }

    void onToggleTask(task.id);
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

  const formattedCompletedAt = task.instance.completedAt
    ? new Intl.DateTimeFormat(language === 'nl' ? 'nl-NL' : 'en-GB', {
        dateStyle: 'medium',
      }).format(new Date(task.instance.completedAt))
    : null;

  return (
    <div
      className={cn(
        'rounded-md px-2 py-2 transition-colors',
        !locked && 'hover:bg-muted/40',
        (isCompleted || isSkipped) && 'opacity-55',
        isSkipped && 'cursor-not-allowed',
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isDisabled}
          role="checkbox"
          aria-checked={isCompleted}
          aria-label={t(task.title)}
          className={cn(
            'mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors',
            isCompleted && 'border-emerald-500 bg-emerald-500 text-white',
            !isCompleted && isWaiting && 'border-amber-300 bg-amber-50 text-amber-700',
            !isCompleted && !isWaiting && 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-primary/5',
            isDisabled && 'cursor-not-allowed opacity-70',
          )}
        >
          {isCompleted ? <Check size={12} /> : isWaiting ? <Hourglass size={11} /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start gap-2">
                <p
                  className={cn(
                    'text-sm font-medium text-foreground',
                    (isCompleted || isSkipped) && 'text-muted-foreground line-through',
                  )}
                >
                  {t(task.title)}
                </p>

                <span
                  className={cn(
                    'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    assigneeStyles[task.assignee],
                  )}
                >
                  {t(assigneeLabelKey[task.assignee])}
                </span>

                {isWaiting && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    <Hourglass size={10} />
                    {t('onboarding.status.waitingExternal')}
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-muted-foreground">{t(task.description)}</p>

              {formattedCompletedAt && (
                <p className="mt-1 text-[11px] text-muted-foreground">{formattedCompletedAt}</p>
              )}

              {isProvisioningTask && provisioningJob && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t('onboarding.jobId')}: {provisioningJob.jobId} • {t('onboarding.retryCount')}: {provisioningJob.retryCount}
                </p>
              )}
            </div>

            {(canGenerateEmail || canTriggerProvisioning || canRetryProvisioning || hasInstructions) && (
              <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                {canGenerateEmail && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsEmailDialogOpen(true)}
                    disabled={isDisabled}
                    className="h-7 gap-1.5 px-2.5 text-xs"
                  >
                    <Mail size={12} />
                    {t('onboarding.action.generateEmail')}
                  </Button>
                )}

                {(canTriggerProvisioning || canRetryProvisioning) && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleProvisioningAction}
                    disabled={isDisabled}
                    className="h-7 gap-1.5 px-2.5 text-xs"
                  >
                    {canRetryProvisioning ? <RotateCcw size={12} /> : <Zap size={12} />}
                    {canRetryProvisioning
                      ? t('onboarding.action.retryProvisioning')
                      : t('onboarding.action.triggerProvisioning')}
                  </Button>
                )}

                {hasInstructions && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowInstructions((prev) => !prev)}
                    className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <BookOpen size={12} />
                    {showInstructions ? t('onboarding.action.hideSteps') : t('onboarding.action.viewSteps')}
                  </Button>
                )}
              </div>
            )}
          </div>

          {showInstructions && task.instructions && (
            <div className="mt-2 rounded-md border border-border/70 bg-muted/30 p-3">
              <ol className="space-y-1.5">
                {task.instructions.steps.map((stepKey, index) => (
                  <li key={`${task.id}-${stepKey}`} className="flex items-start gap-2 text-xs text-foreground">
                    <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-[10px] font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <span>{t(stepKey)}</span>
                  </li>
                ))}
              </ol>

              {task.instructions.links && task.instructions.links.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {task.instructions.links.map((link) => (
                    <a
                      key={`${task.id}-${link.url}`}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {t(link.label)}
                    </a>
                  ))}
                </div>
              )}

              {task.instructions.notes && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t(task.instructions.notes)}
                </p>
              )}
            </div>
          )}

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
      </div>
    </div>
  );
};

export default TaskCard;
