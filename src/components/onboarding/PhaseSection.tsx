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
      onOpenChange={(open) => {
        if (isLocked) {
          return;
        }
        onOpenChange(phaseComputed.phase.id, open);
      }}
    >
      <div>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'w-full rounded-lg px-3 py-3 text-left transition-colors',
              !isLocked && 'hover:bg-muted/40',
              isOpen && !isLocked && 'bg-card shadow-sm ring-1 ring-border/70',
              isLocked && 'cursor-not-allowed',
            )}
            disabled={isLocked}
          >
            <PhaseHeader
              phase={phaseComputed.phase}
              status={phaseComputed.status}
              progress={phaseComputed.progress}
              isOpen={isOpen}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="ml-6 border-l border-border/70 pb-2 pl-3 pr-1">
            <div className="space-y-0.5 pt-1">
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
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default PhaseSection;
