import { useEffect, useState } from 'react';
import type { OnboardingPhaseStatus, OnboardingTaskStatus, PhaseComputed } from '@/data/onboardingTypes';
import { cn } from '@/lib/utils';
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

const timelineDotStyles: Record<OnboardingPhaseStatus, string> = {
  locked: 'border-slate-300 bg-slate-200',
  available: 'border-blue-300 bg-blue-200',
  in_progress: 'border-indigo-300 bg-indigo-200',
  waiting: 'border-amber-300 bg-amber-200',
  completed: 'border-emerald-300 bg-emerald-200',
};

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
      const next = { ...prev };
      let changed = false;

      for (const phase of phases) {
        if (next[phase.phase.id] === undefined) {
          next[phase.phase.id] = phase.status !== 'locked' && phase.status !== 'completed';
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [phases]);

  const handleOpenChange = (phaseId: string, open: boolean) => {
    setOpenPhases((prev) => ({ ...prev, [phaseId]: open }));
  };

  return (
    <div className="space-y-3">
      {phases.map((phase, index) => (
        <div key={phase.phase.id} className="relative pl-6">
          {index < phases.length - 1 && (
            <div className="absolute left-[8px] top-10 h-[calc(100%-0.25rem)] w-px bg-border" />
          )}

          <span
            className={cn(
              'absolute left-[3px] top-5 h-3 w-3 rounded-full border-2',
              timelineDotStyles[phase.status],
            )}
          />

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
