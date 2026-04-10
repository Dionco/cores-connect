import type { OnboardingTaskStatus, PhaseComputed } from '@/data/onboardingTypes';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ExternalRequestEmailContext } from './ExternalRequestEmailDialog';
import PhaseHeader from './PhaseHeader';
import TaskCard from './TaskCard';

interface PhaseSectionProps {
  phaseComputed: PhaseComputed;
  isOpen: boolean;
  disabled?: boolean;
  provisioningJob?: {
    jobId: string;
    retryCount: number;
  } | null;
  onOpenChange: (phaseId: string, open: boolean) => void;
  onToggleTask: (taskTemplateId: string) => void | Promise<void>;
  onSetTaskStatus: (input: { taskTemplateId: string; status: OnboardingTaskStatus }) => void | Promise<void>;
  onTriggerProvisioning: () => void | Promise<void>;
  onRetryProvisioning: () => void | Promise<void>;
  requestEmailContext: ExternalRequestEmailContext;
}

export const PhaseSection = ({
  phaseComputed,
  isOpen,
  disabled = false,
  provisioningJob,
  onOpenChange,
  onToggleTask,
  onSetTaskStatus,
  onTriggerProvisioning,
  onRetryProvisioning,
  requestEmailContext,
}: PhaseSectionProps) => {
  const isLocked = phaseComputed.status === 'locked';

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(open) => onOpenChange(phaseComputed.phase.id, open)}
    >
      <div className={cn('rounded-xl border bg-card p-4', isLocked && 'border-dashed')}>
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full text-left">
            <PhaseHeader
              phase={phaseComputed.phase}
              status={phaseComputed.status}
              progress={phaseComputed.progress}
              isOpen={isOpen}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-3 space-y-2 border-t pt-3">
            {phaseComputed.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                locked={isLocked}
                disabled={disabled}
                provisioningJob={provisioningJob}
                onToggleTask={onToggleTask}
                onSetTaskStatus={onSetTaskStatus}
                onTriggerProvisioning={onTriggerProvisioning}
                onRetryProvisioning={onRetryProvisioning}
                requestEmailContext={requestEmailContext}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default PhaseSection;
