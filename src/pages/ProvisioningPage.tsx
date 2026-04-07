import React, { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { mockProvisioningJobs } from '@/data/mockData';
import { retryProvisioningAutomation } from '@/lib/automation/client';
import { analyzeProvisioningLogs } from '@/lib/provisioning/logAnalyzer';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CheckCircle2, Clock, AlertCircle, Zap, RotateCcw, Mail, Shield, AlertTriangle } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { createAppNotification } from '@/lib/notifications';
import { toast } from '@/hooks/use-toast';

const ProvisioningPage = () => {
  const { t } = useLanguage();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const job = mockProvisioningJobs.find(j => j.id === selectedJob);
  
  const logSummary = useMemo(() => {
    return job ? analyzeProvisioningLogs(job) : null;
  }, [job]);

  const handleRetry = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();

    setRetryingJobId(jobId);

    try {
      const result = await retryProvisioningAutomation(jobId);
      toast({
        title: 'Provisioning job requeued',
        description: `Job ${result.jobId} retry #${result.retryCount} is ${result.status.toLowerCase()}.`,
      });

      void createAppNotification({
        title: 'Provisioning job requeued',
        description: `Job ${result.jobId} was requeued for retry #${result.retryCount}.`,
        type: 'warning',
        link: '/provisioning',
        payload: { jobId: result.jobId, retryCount: result.retryCount, status: result.status },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retry provisioning job.';
      toast({ title: 'Provisioning retry failed', description: message, variant: 'destructive' });
    } finally {
      setRetryingJobId(null);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{t('provisioning.title')}</h1>

      {mockProvisioningJobs.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-muted p-4 mb-4"><Zap size={32} className="text-muted-foreground" /></div>
            <p className="font-medium text-foreground">{t('provisioning.noJobs')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('provisioning.noJobsDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('provisioning.employee')}</TableHead>
                  <TableHead>{t('provisioning.service')}</TableHead>
                  <TableHead>{t('employees.status')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('provisioning.triggeredAt')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('provisioning.completedAt')}</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockProvisioningJobs.map((j) => (
                  <TableRow key={j.id} className="cursor-pointer" onClick={() => setSelectedJob(j.id)}>
                    <TableCell className="font-medium">{j.employeeName}</TableCell>
                    <TableCell>{j.service}</TableCell>
                    <TableCell><StatusBadge status={j.status} /></TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{j.triggeredAt}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{j.completedAt || '—'}</TableCell>
                    <TableCell>
                      {j.status === 'Failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={retryingJobId === j.id}
                          onClick={(e) => {
                            void handleRetry(e, j.id);
                          }}
                        >
                          <RotateCcw size={12} /> {t('provisioning.retry')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail drawer */}
      <Sheet open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('provisioning.log')}</SheetTitle>
          </SheetHeader>
          {job && logSummary && (
            <div className="mt-4 space-y-6">
              {/* Header Info */}
              <div className="space-y-2 border-b pb-4">
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">{t('provisioning.employee')}:</span> <span className="font-medium">{job.employeeName}</span></p>
                  <p><span className="text-muted-foreground">{t('provisioning.service')}:</span> <span className="font-medium">{job.service}</span></p>
                  <p><span className="text-muted-foreground">{t('employees.status')}:</span> <StatusBadge status={job.status} /></p>
                </div>
              </div>

              {/* Summary Section */}
              {(logSummary.mailboxResults.succeeded.length > 0 || logSummary.mailboxResults.failed.length > 0 || logSummary.groupResults.succeeded.length > 0 || logSummary.groupResults.failed.length > 0) && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Provisioning Summary</h3>
                  
                  {/* Mailbox Results */}
                  {logSummary.mailboxResults.succeeded.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        <p className="text-sm font-medium text-emerald-900">Shared Mailboxes Added ({logSummary.mailboxResults.succeeded.length})</p>
                      </div>
                      <ul className="space-y-1">
                        {logSummary.mailboxResults.succeeded.map((email) => (
                          <li key={email} className="text-xs text-emerald-800 flex items-center gap-2">
                            <Mail size={12} /> {email}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {logSummary.mailboxResults.failed.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-destructive" />
                        <p className="text-sm font-medium text-destructive">Shared Mailbox Failures ({logSummary.mailboxResults.failed.length})</p>
                      </div>
                      <ul className="space-y-1">
                        {logSummary.mailboxResults.failed.map((result) => (
                          <li key={result.email} className="text-xs text-destructive flex flex-col gap-1 p-2 rounded bg-destructive/10">
                            <span className="font-medium flex items-center gap-2"><Mail size={12} /> {result.email}</span>
                            <span className="text-destructive/80">{result.error}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Security Group Results */}
                  {logSummary.groupResults.succeeded.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        <p className="text-sm font-medium text-emerald-900">Security Groups Added ({logSummary.groupResults.succeeded.length})</p>
                      </div>
                      <ul className="space-y-1">
                        {logSummary.groupResults.succeeded.map((id) => (
                          <li key={id} className="text-xs text-emerald-800 flex items-center gap-2">
                            <Shield size={12} /> {id}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {logSummary.groupResults.failed.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-destructive" />
                        <p className="text-sm font-medium text-destructive">Security Group Failures ({logSummary.groupResults.failed.length})</p>
                      </div>
                      <ul className="space-y-1">
                        {logSummary.groupResults.failed.map((result) => (
                          <li key={result.id} className="text-xs text-destructive flex flex-col gap-1 p-2 rounded bg-destructive/10">
                            <span className="font-medium flex items-center gap-2"><Shield size={12} /> {result.id}</span>
                            <span className="text-destructive/80">{result.error}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Full Details Logs */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Full Execution Log</h3>
                <div className="space-y-2">
                  {job.logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg border p-3 text-xs">
                      {log.status === 'done' && <CheckCircle2 size={16} className="mt-0.5 text-emerald-500 shrink-0 flex-none" />}
                      {log.status === 'pending' && <Clock size={16} className="mt-0.5 text-cores-orange shrink-0 flex-none" />}
                      {log.status === 'error' && <AlertCircle size={16} className="mt-0.5 text-destructive shrink-0 flex-none" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm break-words">{log.step}</p>
                        {log.timestamp && <p className="text-xs text-muted-foreground mt-1">{log.timestamp}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Error Banner if Failed */}
              {job.status === 'Failed' && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                  <AlertTriangle size={18} className="mt-0.5 text-destructive shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-destructive">Provisioning Failed</p>
                    <p className="text-xs text-destructive/80 mt-1">Click the Retry button above to attempt provisioning again.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ProvisioningPage;
