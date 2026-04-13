import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { Employee } from '@/data/mockData';
import { buildSignatureHtml, defaultSignatureInput, type SignatureInput } from '@/lib/signatureTemplate';
import { useEmployeeDocuments } from '@/hooks/useEmployeeDocuments';
import { Copy, Download, Save } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  employee: Employee;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SignatureGeneratorDialog: React.FC<Props> = ({ employee, open, onOpenChange }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { upload, isUploading } = useEmployeeDocuments(employee.id);
  const [input, setInput] = useState<SignatureInput>(() => defaultSignatureInput(employee, 'en'));

  const html = useMemo(() => buildSignatureHtml(input), [input]);

  const update = <K extends keyof SignatureInput>(key: K, value: SignatureInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(html);
    toast({ title: t('documents.signatureCopied') });
  };

  const handleDownload = () => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signature-${input.locale}-${employee.firstName}.htm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    try {
      const blob = new Blob([html], { type: 'text/html' });
      const date = new Date().toISOString().slice(0, 10);
      await upload({
        employeeId: employee.id,
        category: 'signature',
        file: blob,
        filename: `signature-${input.locale}-${date}.htm`,
        mimeType: 'text/html',
        meta: { ...input, generatedAt: new Date().toISOString() },
      });
      toast({ title: t('documents.signatureSaved') });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: t('documents.signatureSaveFailed'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t('documents.signatureTitle')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <Label htmlFor="sig-locale">{t('documents.signatureLocale')}</Label>
              <Select value={input.locale} onValueChange={(v) => update('locale', v as 'en' | 'nl')}>
                <SelectTrigger id="sig-locale"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="nl">Nederlands</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sig-name">{t('documents.signatureFullName')}</Label>
              <Input id="sig-name" value={input.fullName} onChange={(e) => update('fullName', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="sig-role">{t('documents.signatureRole')}</Label>
              <Input id="sig-role" value={input.role} onChange={(e) => update('role', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="sig-phone">{t('documents.signaturePhone')}</Label>
              <Input id="sig-phone" value={input.phone} onChange={(e) => update('phone', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="sig-address">{t('documents.signatureAddress')}</Label>
              <Input id="sig-address" value={input.addressLine} onChange={(e) => update('addressLine', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="sig-presence">{t('documents.signaturePresence')}</Label>
              <Input
                id="sig-presence"
                placeholder={t('documents.signaturePresencePlaceholder')}
                value={input.presenceLine || ''}
                onChange={(e) => update('presenceLine', e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border bg-white p-2">
            <iframe
              title="signature-preview"
              srcDoc={html}
              sandbox=""
              className="h-[420px] w-full rounded border-0"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCopy} className="gap-2">
            <Copy size={16} /> {t('documents.signatureCopy')}
          </Button>
          <Button variant="outline" onClick={handleDownload} className="gap-2">
            <Download size={16} /> {t('documents.signatureDownload')}
          </Button>
          <Button onClick={handleSave} disabled={isUploading} className="gap-2">
            <Save size={16} /> {t('documents.signatureSave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SignatureGeneratorDialog;
