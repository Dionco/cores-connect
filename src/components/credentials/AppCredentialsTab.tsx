import React, { useState } from 'react';
import type { Employee } from '@/data/mockData';
import { useAppCredentials } from '@/hooks/useAppCredentials';
import type { AppCredential } from '@/lib/appCredentials';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Copy, ExternalLink, Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import AppCredentialDialog from './AppCredentialDialog';

const CLIPBOARD_CLEAR_MS = 20_000;

const copyAndClear = async (value: string, onCleared: () => void) => {
  await navigator.clipboard.writeText(value);
  window.setTimeout(async () => {
    try {
      const current = await navigator.clipboard.readText();
      if (current === value) {
        await navigator.clipboard.writeText('');
      }
    } catch {
      // clipboard read may be blocked; best-effort only
    }
    onCleared();
  }, CLIPBOARD_CLEAR_MS);
};

interface Props {
  employee: Employee;
}

export const AppCredentialsTab: React.FC<Props> = ({ employee }) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { credentials, isLoading, remove, reveal } = useAppCredentials(employee.id);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppCredential | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AppCredential | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  const fetchPassword = async (cred: AppCredential): Promise<string | null> => {
    if (revealed[cred.id]) return revealed[cred.id];
    setBusyId(cred.id);
    try {
      const password = await reveal(cred.id);
      setRevealed((prev) => ({ ...prev, [cred.id]: password }));
      return password;
    } catch (err) {
      toast({
        title: t('credentials.revealFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleReveal = async (cred: AppCredential) => {
    if (revealed[cred.id]) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[cred.id];
        return next;
      });
      return;
    }
    await fetchPassword(cred);
  };

  const handleCopyPassword = async (cred: AppCredential) => {
    const password = await fetchPassword(cred);
    if (!password) return;
    await copyAndClear(password, () => {
      toast({ title: t('credentials.clipboardCleared') });
    });
    toast({
      title: t('credentials.passwordCopied'),
      description: t('credentials.clipboardWillClear'),
    });
  };

  const handleCopyUsername = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: t('credentials.usernameCopied') });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await remove(pendingDelete.id);
      toast({ title: t('credentials.deleted') });
    } catch (err) {
      toast({
        title: t('credentials.deleteFailed'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t('credentials.securityNotice')}</p>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2">
          <Plus size={16} /> {t('credentials.add')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> {t('credentials.loading')}
        </div>
      ) : credentials.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t('credentials.empty')}
        </div>
      ) : (
        <div className="space-y-2">
          {credentials.map((cred) => (
            <div key={cred.id} className="flex items-center gap-3 rounded-lg border p-3">
              <KeyRound size={18} className="text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{cred.appName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {cred.username || t('credentials.noUsername')}
                </p>
                {cred.hasPassword && (
                  <p className="mt-1 font-mono text-xs">
                    {revealed[cred.id] ? revealed[cred.id] : '••••••••'}
                  </p>
                )}
              </div>
              {cred.loginUrl && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={cred.loginUrl} target="_blank" rel="noopener noreferrer" aria-label={t('credentials.open')}>
                    <ExternalLink size={14} />
                  </a>
                </Button>
              )}
              {cred.username && (
                <Button variant="ghost" size="sm" onClick={() => handleCopyUsername(cred.username!)} aria-label={t('credentials.copyUsername')} title={t('credentials.copyUsername')}>
                  <Copy size={14} />
                </Button>
              )}
              {cred.hasPassword && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === cred.id}
                    onClick={() => handleToggleReveal(cred)}
                    aria-label={revealed[cred.id] ? t('credentials.hide') : t('credentials.reveal')}
                    title={revealed[cred.id] ? t('credentials.hide') : t('credentials.reveal')}
                  >
                    {busyId === cred.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : revealed[cred.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === cred.id}
                    onClick={() => handleCopyPassword(cred)}
                    aria-label={t('credentials.copyPassword')}
                    title={t('credentials.copyPassword')}
                  >
                    <KeyRound size={14} />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={() => { setEditing(cred); setDialogOpen(true); }} aria-label={t('credentials.edit')}>
                <Pencil size={14} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setPendingDelete(cred)}
                aria-label={t('credentials.delete')}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AppCredentialDialog
        employeeId={employee.id}
        credential={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('credentials.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('credentials.deleteConfirmDescription')} {pendingDelete?.appName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('credentials.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('credentials.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AppCredentialsTab;
