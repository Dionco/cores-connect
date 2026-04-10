import { useMemo, useState } from 'react';
import { Copy, Mail } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface ExternalRequestEmailContext {
  employeeName: string;
  employeeEmail: string;
  department: string;
  startDate: string;
  adminName: string;
  adminEmail: string;
}

interface ExternalRequestEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  context: ExternalRequestEmailContext;
  disabled?: boolean;
  onMarkAsSent: () => Promise<void> | void;
}

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

export const ExternalRequestEmailDialog = ({
  open,
  onOpenChange,
  taskId,
  context,
  disabled = false,
  onMarkAsSent,
}: ExternalRequestEmailDialogProps) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isTransportplan = taskId === 'request-transportplan';

  const emailData = useMemo(() => {
    const placeholders = {
      employeeName: context.employeeName,
      employeeEmail: context.employeeEmail,
      department: context.department,
      startDate: context.startDate,
      adminName: context.adminName,
      adminEmail: context.adminEmail,
    };

    const to = isTransportplan
      ? t('onboarding.email.transportplan.to')
      : t('onboarding.email.horizon3.to');

    const subjectPrefix = isTransportplan
      ? t('onboarding.email.transportplan.subjectPrefix')
      : t('onboarding.email.horizon3.subjectPrefix');

    const subject = `${subjectPrefix} - ${context.employeeName}`;

    const bodyTemplate = isTransportplan
      ? t('onboarding.email.transportplan.bodyTemplate')
      : t('onboarding.email.horizon3.bodyTemplate');

    const body = interpolate(bodyTemplate, placeholders);
    const preview = `To: ${to}\nSubject: ${subject}\n\n${body}`;

    return { to, subject, body, preview };
  }, [context, isTransportplan, t]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emailData.preview);
      toast({
        title: t('onboarding.action.copyToClipboard'),
        description: t('onboarding.email.copySuccess'),
      });
    } catch {
      toast({
        title: t('onboarding.action.copyToClipboard'),
        description: t('onboarding.email.copyError'),
        variant: 'destructive',
      });
    }
  };

  const handleMarkAsSent = async () => {
    setIsSubmitting(true);
    try {
      await onMarkAsSent();
      toast({
        title: t('onboarding.action.markAsSent'),
        description: t('onboarding.email.markSentSuccess'),
      });
      onOpenChange(false);
    } catch {
      toast({
        title: t('onboarding.action.markAsSent'),
        description: t('onboarding.email.markSentError'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const mailtoUrl = `mailto:${encodeURIComponent(emailData.to)}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('onboarding.email.dialog.title')}</DialogTitle>
          <DialogDescription>{t('onboarding.email.dialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('onboarding.email.field.to')}</Label>
            <Input value={emailData.to} readOnly />
          </div>

          <div className="space-y-1.5">
            <Label>{t('onboarding.email.field.subject')}</Label>
            <Input value={emailData.subject} readOnly />
          </div>

          <div className="space-y-1.5">
            <Label>{t('onboarding.email.field.body')}</Label>
            <Textarea value={emailData.body} readOnly className="min-h-[280px] text-xs" />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCopy()}
            disabled={disabled || isSubmitting}
            className="gap-2"
          >
            <Copy size={14} />
            {t('onboarding.action.copyToClipboard')}
          </Button>

          <Button type="button" variant="outline" asChild>
            <a href={mailtoUrl} className="gap-2">
              <Mail size={14} />
              {t('onboarding.action.openInMail')}
            </a>
          </Button>

          <Button
            type="button"
            onClick={() => void handleMarkAsSent()}
            disabled={disabled || isSubmitting}
          >
            {t('onboarding.action.markAsSent')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExternalRequestEmailDialog;