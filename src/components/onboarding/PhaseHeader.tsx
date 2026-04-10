import { ChevronDown, ChevronRight, Lock } from 'lucide-react';
import type { OnboardingPhaseStatus, OnboardingPhaseTemplate, PhaseProgress } from '@/data/onboardingTypes';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PhaseHeaderProps {
  phase: OnboardingPhaseTemplate;
  status: OnboardingPhaseStatus;
  progress: PhaseProgress;
  isOpen: boolean;
}

const phaseStatusStyles: Record<OnboardingPhaseStatus, string> = {
  locked: 'border-slate-200 bg-slate-100 text-slate-700',
  available: 'border-blue-200 bg-blue-50 text-blue-700',
  in_progress: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  waiting: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const phaseStatusLabelKey: Record<OnboardingPhaseStatus, string> = {
  locked: 'onboarding.status.locked',
  available: 'onboarding.status.available',
  in_progress: 'onboarding.status.inProgress',
  waiting: 'onboarding.status.waiting',
  completed: 'onboarding.status.completed',
};

export const PhaseHeader = ({ phase, status, progress, isOpen }: PhaseHeaderProps) => {
  const { t } = useLanguage();

  return (
    <div className={cn('flex items-start justify-between gap-3', status === 'locked' && 'text-muted-foreground')}>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold">
            {phase.order}
          </span>
          <p className="text-sm font-semibold text-foreground">{t(phase.title)}</p>
          {status === 'locked' && <Lock size={14} className="text-muted-foreground" />}
        </div>

        <p className="text-xs text-muted-foreground">{t(phase.description)}</p>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">
          {progress.completed}/{progress.total}
        </p>

        <Badge
          variant="outline"
          className={cn('text-[10px] font-medium', phaseStatusStyles[status])}
        >
          {t(phaseStatusLabelKey[status])}
        </Badge>

        {isOpen ? (
          <ChevronDown size={16} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={16} className="text-muted-foreground" />
        )}
      </div>
    </div>
  );
};

export default PhaseHeader;
