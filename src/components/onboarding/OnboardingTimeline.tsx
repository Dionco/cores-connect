import { useEffect, useState } from 'react';
import type { OnboardingTaskStatus, PhaseComputed } from '@/data/onboardingTypes';
import type { ExternalRequestEmailContext } from './ExternalRequestEmailDialog';
import PhaseSection from './PhaseSection';

interface OnboardingTimelineProps {
  phases: PhaseComputed[];
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

export const OnboardingTimeline = ({
  phases,
  disabled = false,
  provisioningJob,
  onToggleTask,
  onSetTaskStatus,
  onTriggerProvisioning,
  onRetryProvisioning,
  requestEmailContext,
}: OnboardingTimelineProps) => {
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenPhases((prev) => {
      const next: Record<string, boolean> = {};
      let changed = false;

      for (const phase of phases) {
        const isLockedOrDone = phase.status === 'locked' || phase.status === 'completed';
        const isAutoExpanded = phase.status === 'in_progress' || phase.status === 'waiting';
        const isDefaultExpanded = phase.status === 'available';

        const nextOpen = isLockedOrDone
          ? false
          : isAutoExpanded
            ? true
            : prev[phase.phase.id] ?? isDefaultExpanded;

        next[phase.phase.id] = nextOpen;

        if (prev[phase.phase.id] !== nextOpen) {
          changed = true;
        }
      }

      for (const previousPhaseId of Object.keys(prev)) {
        if (!(previousPhaseId in next)) {
          changed = true;
          break;
        }
      }

      return changed ? next : prev;
    });
  }, [phases]);

  const handleOpenChange = (phaseId: string, open: boolean) => {
    setOpenPhases((prev) => ({ ...prev, [phaseId]: open }));
  };

  return (
    <div className="space-y-1">
      {phases.map((phase) => (
        <div key={phase.phase.id}>
          <PhaseSection
            phaseComputed={phase}
            isOpen={openPhases[phase.phase.id] ?? false}
            disabled={disabled}
            provisioningJob={provisioningJob}
            onOpenChange={handleOpenChange}
            onToggleTask={onToggleTask}
            onSetTaskStatus={onSetTaskStatus}
            onTriggerProvisioning={onTriggerProvisioning}
            onRetryProvisioning={onRetryProvisioning}
            requestEmailContext={requestEmailContext}
          />
        </div>
      ))}
    </div>
  );
};

export default OnboardingTimeline;
