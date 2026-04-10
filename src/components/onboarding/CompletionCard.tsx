import { CalendarDays, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';

interface CompletionCardProps {
  employeeName: string;
  completedAt?: string;
  completedTasks: number;
  totalTasks: number;
}

const formatCompletedAt = (value: string, language: 'en' | 'nl') => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === 'nl' ? 'nl-NL' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export const CompletionCard = ({
  employeeName,
  completedAt,
  completedTasks,
  totalTasks,
}: CompletionCardProps) => {
  const { language, t } = useLanguage();

  return (
    <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={18} />
          </span>

          <div className="min-w-0">
            <p className="text-base font-semibold text-emerald-900">
              {t('onboarding.completion.title')}
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              {t('onboarding.completion.message').replace('{name}', employeeName)}
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              {t('onboarding.completion.overview')}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-white/70 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
              {t('onboarding.completion.taskSummary')}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <ClipboardCheck size={14} />
              {completedTasks}/{totalTasks}
            </p>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-white/70 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
              {t('onboarding.completion.completedOn')}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <CalendarDays size={14} />
              {completedAt ? formatCompletedAt(completedAt, language) : '-'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompletionCard;
