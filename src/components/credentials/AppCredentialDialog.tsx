import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppCredentials } from '@/hooks/useAppCredentials';
import type { AppCredential } from '@/lib/appCredentials';

interface Props {
  employeeId: string;
  credential: AppCredential | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AppCredentialDialog: React.FC<Props> = ({ employeeId, credential, open, onOpenChange }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { upsert, isSaving } = useAppCredentials(employeeId);

  const [appName, setAppName] = useState('');
  const [loginUrl, setLoginUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setAppName(credential?.appName || '');
      setLoginUrl(credential?.loginUrl || '');
      setUsername(credential?.username || '');
      setNotes(credential?.notes || '');
      setPassword('');
    }
  }, [open, credential]);

  const handleSave = async () => {
    if (!appName.trim()) {
      toast({ title: t('credentials.appNameRequired'), variant: 'destructive' });
      return;
    }
    try {
      await upsert({
        id: credential?.id,
        employeeId,
        appName: appName.trim(),
        loginUrl: loginUrl.trim() || null,
        username: username.trim() || null,
        notes: notes.trim() || null,
        password: password ? password : null,
      });
      toast({ title: credential ? t('credentials.updated') : t('credentials.created') });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: t('credentials.saveFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{credential ? t('credentials.editTitle') : t('credentials.addTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cred-app">{t('credentials.appName')}</Label>
            <Input id="cred-app" value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Slite, Tribe CRM, Apple ID…" />
          </div>
          <div>
            <Label htmlFor="cred-url">{t('credentials.loginUrl')}</Label>
            <Input id="cred-url" value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <Label htmlFor="cred-username">{t('credentials.username')}</Label>
            <Input id="cred-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <Label htmlFor="cred-password">
              {t('credentials.password')}
              {credential?.hasPassword && (
                <span className="ml-2 text-xs text-muted-foreground">{t('credentials.passwordLeaveBlank')}</span>
              )}
            </Label>
            <Input
              id="cred-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={credential?.hasPassword ? '••••••••' : ''}
            />
          </div>
          <div>
            <Label htmlFor="cred-notes">{t('credentials.notes')}</Label>
            <Textarea id="cred-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('credentials.cancel')}</Button>
          <Button onClick={handleSave} disabled={isSaving}>{t('credentials.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AppCredentialDialog;
