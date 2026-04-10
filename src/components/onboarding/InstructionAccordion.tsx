import { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { TaskInstruction } from '@/data/onboardingTypes';
import { useLanguage } from '@/contexts/LanguageContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface InstructionAccordionProps {
  instructions?: TaskInstruction;
}

export const InstructionAccordion = ({ instructions }: InstructionAccordionProps) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  if (!instructions || instructions.steps.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 rounded-md border border-border/70 bg-muted/30">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-medium text-foreground">{t('onboarding.instructions.title')}</span>
        {isOpen ? (
          <ChevronDown size={14} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground" />
        )}
      </button>

      <div
        className={cn(
          'grid transition-all duration-200',
          isOpen ? 'grid-rows-[1fr] border-t' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 px-3 py-3">
            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-foreground">
              {instructions.steps.map((stepKey) => (
                <li key={stepKey}>{t(stepKey)}</li>
              ))}
            </ol>

            {instructions.links && instructions.links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {instructions.links.map((link) => (
                  <a
                    key={`${link.label}-${link.url}`}
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

            {instructions.notes && (
              <Alert className="border-blue-200 bg-blue-50 p-2.5 [&>svg]:left-2.5 [&>svg]:top-2.5 [&>svg]:text-blue-600 [&>svg~*]:pl-6">
                <Info size={14} />
                <AlertDescription className="text-xs text-blue-900">
                  {t(instructions.notes)}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstructionAccordion;