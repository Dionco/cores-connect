import { CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import type { OnboardingPhaseStatus, OnboardingPhaseTemplate, PhaseProgress } from '@/data/onboardingTypes';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface PhaseHeaderProps {
  phase: OnboardingPhaseTemplate;
  status: OnboardingPhaseStatus;
  progress: PhaseProgress;
  isOpen: boolean;
}

const indicatorStyles: Record<OnboardingPhaseStatus, string> = {
  locked: 'border-slate-300 bg-slate-100 text-slate-500',
  available: 'border-blue-300 bg-blue-50 text-blue-700',
  in_progress: 'border-indigo-300 bg-indigo-50 text-indigo-700',
  waiting: 'border-amber-300 bg-amber-50 text-amber-700',
  completed: 'border-emerald-500 bg-emerald-500 text-white',
};

export const PhaseHeader = ({ phase, status, progress, isOpen }: PhaseHeaderProps) => {
  const { t } = useLanguage();
  const isLocked = status === 'locked';
  const isWaiting = status === 'waiting';
  const isActive = status === 'in_progress' || status === 'available';

  return (
    <div className={cn('flex items-start gap-3', isLocked && 'opacity-60')}>
      <span
        className={cn(
          'mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
          indicatorStyles[status],
        )}
      >
        {status === 'completed' ? <CheckCircle2 size={14} /> : isLocked ? <Lock size={11} /> : phase.order}
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold text-foreground', isLocked && 'text-muted-foreground')}>
          {t(phase.title)}
        </p>
        <p className="text-xs text-muted-foreground">{t(phase.description)}</p>
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <p className="text-xs font-medium tabular-nums text-muted-foreground">
          {progress.completed}/{progress.total}
        </p>

        {isWaiting && <span className="h-2 w-2 rounded-full bg-amber-500" />}
        {isActive && <span className="h-2 w-2 rounded-full bg-indigo-500" />}

        {!isLocked && (
          <ChevronRight
            size={16}
            className={cn('text-muted-foreground transition-transform duration-200', isOpen && 'rotate-90')}
          />
        )}
      </div>
    </div>
  );
};

export default PhaseHeader;
