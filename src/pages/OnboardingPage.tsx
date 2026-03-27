import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { mockEmployees } from '@/data/mockData';
import { triggerOnboardingAutomation } from '@/lib/automation/client';
import { createAppNotification } from '@/lib/notifications';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, Zap, ClipboardCheck, ArrowLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const OnboardingPage = () => {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const onboardingEmployees = mockEmployees.filter(e => e.status === 'Onboarding');
  const selected = onboardingEmployees.find(e => e.id === selectedId);

  const handleStartM365Automation = async () => {
    if (!selected || isTriggering) {
      return;
    }

    setIsTriggering(true);
    try {
      const result = await triggerOnboardingAutomation({
        employeeId: selected.id,
        service: 'M365',
      });

      toast({
        title: t('onboarding.automationTriggered'),
        description: result.reused
          ? t('onboarding.automationReused')
          : `${t('onboarding.jobId')}: ${result.jobId}`,
      });

      void createAppNotification({
        title: t('onboarding.automationTriggered'),
        description: `${selected.firstName} ${selected.lastName} (${result.jobId})`,
        type: 'success',
        link: '/provisioning',
        payload: {
          employeeId: selected.id,
          jobId: result.jobId,
          reused: result.reused,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('onboarding.automationError');
      toast({
        title: t('onboarding.automationError'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsTriggering(false);
    }
  };

  if (selected) {
    const completed = selected.onboardingTasks.filter(t => t.completed).length;
    const total = selected.onboardingTasks.length;
    const pct = Math.round((completed / total) * 100);

    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setSelectedId(null)} className="gap-2 text-muted-foreground">
          <ArrowLeft size={16} /> {t('onboarding.title')}
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{selected.firstName} {selected.lastName}</h1>
            <p className="text-sm text-muted-foreground">{selected.department} · {selected.role}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">{pct}%</p>
              <p className="text-xs text-muted-foreground">{completed}/{total} {t('onboarding.tasks').toLowerCase()}</p>
            </div>
            <Button
              size="sm"
              onClick={handleStartM365Automation}
              disabled={isTriggering}
              className="gap-2"
            >
              <Zap size={14} />
              {isTriggering ? t('onboarding.triggering') : t('onboarding.startAutomation')}
            </Button>
          </div>
        </div>

        <Progress value={pct} className="h-2" />

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-2">
            {selected.onboardingTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 rounded-lg border p-3">
                {task.completed ? (
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                ) : (
                  <div className="h-[18px] w-[18px] rounded-full border-2 border-muted-foreground/30 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{t(task.key)}</p>
                  {task.completedAt && <p className="text-xs text-muted-foreground">{task.completedAt}</p>}
                </div>
                {task.automated && (
                  <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-foreground">
                    <Zap size={10} /> {t('onboarding.automated')}
                  </span>
                )}
                {!task.automated && !task.completed && (
                  <span className="text-[10px] text-muted-foreground">{t('onboarding.manual')}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">{t('onboarding.title')}</h1>

      {onboardingEmployees.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-muted p-4 mb-4">
              <ClipboardCheck size={32} className="text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">{t('onboarding.noActive')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('onboarding.noActiveDesc')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('employees.name')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('employees.department')}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t('employees.startDate')}</TableHead>
                  <TableHead>{t('onboarding.progress')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('onboarding.daysSinceStart')}</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {onboardingEmployees.map((emp) => {
                  const completed = emp.onboardingTasks.filter(t => t.completed).length;
                  const total = emp.onboardingTasks.length;
                  const pct = Math.round((completed / total) * 100);
                  const daysSince = Math.floor((new Date('2026-03-23').getTime() - new Date(emp.startDate).getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <TableRow key={emp.id} className="cursor-pointer" onClick={() => setSelectedId(emp.id)}>
                      <TableCell className="font-medium">{emp.firstName} {emp.lastName}</TableCell>
                      <TableCell className="hidden sm:table-cell">{emp.department}</TableCell>
                      <TableCell className="hidden sm:table-cell">{emp.startDate}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2 w-20" />
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{daysSince}d</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedId(emp.id); }}>
                          {t('onboarding.view')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OnboardingPage;
