import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { mockProvisioningJobs } from '@/data/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CheckCircle2, Clock, AlertCircle, Zap, RotateCcw } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { toast } from '@/hooks/use-toast';

const ProvisioningPage = () => {
  const { t } = useLanguage();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const job = mockProvisioningJobs.find(j => j.id === selectedJob);

  const handleRetry = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    toast({ title: 'Provisioning job requeued', description: `Job ${jobId} has been requeued.` });
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
                        <Button size="sm" variant="outline" className="gap-1" onClick={(e) => handleRetry(e, j.id)}>
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
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t('provisioning.log')}</SheetTitle>
          </SheetHeader>
          {job && (
            <div className="mt-4 space-y-4">
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">{t('provisioning.employee')}:</span> <span className="font-medium">{job.employeeName}</span></p>
                <p><span className="text-muted-foreground">{t('provisioning.service')}:</span> <span className="font-medium">{job.service}</span></p>
                <p><span className="text-muted-foreground">{t('employees.status')}:</span> <StatusBadge status={job.status} /></p>
              </div>
              <div className="space-y-2">
                {job.logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    {log.status === 'done' && <CheckCircle2 size={16} className="mt-0.5 text-emerald-500 shrink-0" />}
                    {log.status === 'pending' && <Clock size={16} className="mt-0.5 text-cores-orange shrink-0" />}
                    {log.status === 'error' && <AlertCircle size={16} className="mt-0.5 text-destructive shrink-0" />}
                    <div>
                      <p className="text-sm font-medium">{log.step}</p>
                      {log.timestamp && <p className="text-xs text-muted-foreground">{log.timestamp}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ProvisioningPage;
