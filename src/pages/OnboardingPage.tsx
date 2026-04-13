import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEmployees } from '@/hooks/useEmployees';
import { ONBOARDING_PHASES, ONBOARDING_TASKS } from '@/data/onboardingTemplate';
import type { Department, Employee, OnboardingTask } from '@/data/mockData';
import { triggerOnboardingAutomation } from '@/lib/automation/client';
import { createAppNotification } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  ClipboardCheck,
  Hourglass,
  RotateCcw,
  Search,
  X,
  Zap,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type FilterValue = 'all' | 'attention' | 'waiting' | 'new';
type PhaseStatus = 'available' | 'in_progress' | 'waiting' | 'completed';
type ResolvedTaskStatus = 'pending' | 'in_progress' | 'waiting_external' | 'completed' | 'skipped';

type EmployeePhaseView = {
  id: string;
  labelKey: string;
  completed: number;
  total: number;
  status: PhaseStatus;
  order: number;
};

type EmployeeCardView = {
  employee: Employee;
  completed: number;
  total: number;
  progressPct: number;
  daysSinceStart: number;
  hasBlocker: boolean;
  hasM365Created: boolean;
  isWaiting: boolean;
  isNotStarted: boolean;
  nextTask?: OnboardingTask;
  nextTaskStatus?: ResolvedTaskStatus;
  phases: EmployeePhaseView[];
};

type ResolvedTaskView = {
  task: OnboardingTask;
  phaseId: string;
  status: ResolvedTaskStatus;
  sortIndex: number;
};

const departmentAvatarClass: Record<Department, string> = {
  Sales: 'bg-blue-100 text-blue-700',
  Transport: 'bg-amber-100 text-amber-700',
  'Customs & Compliance': 'bg-indigo-100 text-indigo-700',
  Operations: 'bg-emerald-100 text-emerald-700',
  Planning: 'bg-pink-100 text-pink-700',
  Logistics: 'bg-violet-100 text-violet-700',
};

const phaseTemplateById = new Map(ONBOARDING_PHASES.map((phase) => [phase.id, phase]));
const taskTemplateById = new Map(ONBOARDING_TASKS.map((task) => [task.id, task]));

const legacyPhaseByTaskKey: Record<string, string> = {
  'task.m365Created': 'internal-accounts',
  'task.licenseAssigned': 'internal-accounts',
  'task.emailConfigured': 'internal-accounts',
  'task.sharepointGroup': 'internal-accounts',
  'task.appleBusinessManager': 'internal-accounts',
  'task.loginPdf': 'instructions-delivery',
  'task.sliteInvite': 'system-activation',
  'task.tribeCrmInvite': 'system-activation',
};

const AUTOMATION_M365_TASK_IDS = new Set(['provision-cores-m365']);
const AUTOMATION_M365_TASK_KEYS = new Set(['onboarding.task.provisionCoresM365', 'task.m365Created']);
const NON_AUTOMATION_M365_TASK_IDS = new Set(['request-horizon3-m365']);
const NON_AUTOMATION_M365_TASK_KEYS = new Set(['onboarding.task.requestHorizon3M365']);

const phaseStatusClass: Record<PhaseStatus, string> = {
  available: 'bg-blue-400/80',
  in_progress: 'bg-indigo-500',
  waiting: 'bg-amber-500',
  completed: 'bg-emerald-500',
};

const phaseDotClass: Record<PhaseStatus, string> = {
  available: 'bg-blue-400',
  in_progress: 'bg-indigo-500',
  waiting: 'bg-amber-500',
  completed: 'bg-emerald-500',
};

const getInitials = (firstName: string, lastName: string) => {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
};

const getDaysSince = (startDate: string) => {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)));
};

const normalizeTaskStatus = (task: OnboardingTask): ResolvedTaskStatus => {
  if (task.status) {
    return task.status;
  }

  return task.completed ? 'completed' : 'pending';
};

const resolveTaskPhase = (task: OnboardingTask): string => {
  if (task.phaseId) {
    return task.phaseId;
  }

  const template = taskTemplateById.get(task.id);
  if (template) {
    return template.phaseId;
  }

  if (task.key.startsWith('task.sharedMailbox')) {
    return 'internal-accounts';
  }

  return legacyPhaseByTaskKey[task.key] || 'internal-accounts';
};

const hasCompletedM365Provisioning = (employee: Employee): boolean => {
  if (employee.provisioningStatus === 'Provisioned') {
    return true;
  }

  const hasCompletedAutomationTask = employee.onboardingTasks.some((task) => {
    if (NON_AUTOMATION_M365_TASK_IDS.has(task.id) || NON_AUTOMATION_M365_TASK_KEYS.has(task.key)) {
      return false;
    }

    const isM365ProvisioningTask = AUTOMATION_M365_TASK_IDS.has(task.id) || AUTOMATION_M365_TASK_KEYS.has(task.key);
    if (!isM365ProvisioningTask) {
      return false;
    }

    if (task.status) {
      return task.status === 'completed';
    }

    return task.completed;
  });

  if (hasCompletedAutomationTask) {
    return true;
  }

  return employee.provisioningItems.some((item) => {
    if (item.service !== 'M365' || !item.completed) {
      return false;
    }

    const label = item.label.toLowerCase();
    return label.includes('email created') || label.includes('m365 account created');
  });
};

const buildEmployeeCardView = (employee: Employee): EmployeeCardView => {
  const resolvedTasks: ResolvedTaskView[] = employee.onboardingTasks.map((task, index) => {
    const phaseId = resolveTaskPhase(task);
    const status = normalizeTaskStatus(task);
    const phaseOrder = phaseTemplateById.get(phaseId)?.order ?? 99;
    const taskOrder = taskTemplateById.get(task.id)?.order ?? index;

    return {
      task,
      phaseId,
      status,
      sortIndex: phaseOrder * 100 + taskOrder,
    };
  });

  const activeTasks = resolvedTasks.filter((task) => task.status !== 'skipped');
  const completed = activeTasks.filter((task) => task.status === 'completed').length;
  const total = activeTasks.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const tasksByPhase = new Map<string, ResolvedTaskView[]>();
  activeTasks.forEach((task) => {
    const existing = tasksByPhase.get(task.phaseId) || [];
    existing.push(task);
    tasksByPhase.set(task.phaseId, existing);
  });

  const phases = Array.from(tasksByPhase.entries())
    .map(([phaseId, tasks]) => {
      const phaseCompleted = tasks.filter((task) => task.status === 'completed').length;
      const phaseTotal = tasks.length;
      const anyWaiting = tasks.some((task) => task.status === 'waiting_external');
      const anyInProgress = tasks.some((task) => task.status === 'in_progress');

      let status: PhaseStatus = 'available';
      if (phaseCompleted === phaseTotal) {
        status = 'completed';
      } else if (anyWaiting) {
        status = 'waiting';
      } else if (anyInProgress || phaseCompleted > 0) {
        status = 'in_progress';
      }

      const phaseTemplate = phaseTemplateById.get(phaseId);

      return {
        id: phaseId,
        labelKey: phaseTemplate?.title || 'onboarding.phase.internalAccounts',
        completed: phaseCompleted,
        total: phaseTotal,
        status,
        order: phaseTemplate?.order ?? 99,
      } satisfies EmployeePhaseView;
    })
    .sort((a, b) => a.order - b.order);

  const nextPendingTask = activeTasks
    .filter((task) => task.status !== 'completed')
    .sort((a, b) => a.sortIndex - b.sortIndex)[0];

  const hasBlocker = employee.provisioningStatus === 'Failed';
  const hasM365Created = hasCompletedM365Provisioning(employee);
  const isWaiting =
    employee.provisioningStatus === 'Pending'
    || activeTasks.some((task) => task.status === 'waiting_external');
  const isNotStarted = !activeTasks.some((task) => (
    task.status === 'completed'
    || task.status === 'in_progress'
    || task.status === 'waiting_external'
  ));

  return {
    employee,
    completed,
    total,
    progressPct,
    daysSinceStart: getDaysSince(employee.startDate),
    hasBlocker,
    hasM365Created,
    isWaiting,
    isNotStarted,
    nextTask: nextPendingTask?.task,
    nextTaskStatus: nextPendingTask?.status,
    phases,
  };
};

const getSortRank = (employeeView: EmployeeCardView) => {
  if (employeeView.hasBlocker) return 0;
  if (employeeView.isWaiting) return 1;
  if (employeeView.isNotStarted) return 2;
  return 3;
};

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [automationEmployeeId, setAutomationEmployeeId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterValue>('all');
  const { employees } = useEmployees();

  const onboardingEmployees = useMemo(
    () => employees.filter((employee) => employee.status === 'Onboarding'),
    [employees],
  );

  const employeeCards = useMemo(
    () => onboardingEmployees.map((employee) => buildEmployeeCardView(employee)),
    [onboardingEmployees],
  );

  const summary = useMemo(() => {
    const active = employeeCards.length;
    const inProgress = employeeCards.filter((employee) => !employee.isNotStarted && employee.progressPct < 100).length;
    const waiting = employeeCards.filter((employee) => employee.isWaiting).length;
    const needsAttention = employeeCards.filter((employee) => employee.hasBlocker).length;

    return {
      active,
      inProgress,
      waiting,
      needsAttention,
    };
  }, [employeeCards]);

  const filteredEmployees = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return employeeCards
      .filter((employee) => {
        if (!searchValue) {
          return true;
        }

        const searchTarget = `${employee.employee.firstName} ${employee.employee.lastName} ${employee.employee.department} ${employee.employee.role}`.toLowerCase();
        return searchTarget.includes(searchValue);
      })
      .filter((employee) => {
        if (filter === 'attention') {
          return employee.hasBlocker;
        }

        if (filter === 'waiting') {
          return employee.isWaiting;
        }

        if (filter === 'new') {
          return employee.isNotStarted;
        }

        return true;
      })
      .sort((a, b) => {
        const rankDiff = getSortRank(a) - getSortRank(b);
        if (rankDiff !== 0) {
          return rankDiff;
        }

        if (a.progressPct !== b.progressPct) {
          return a.progressPct - b.progressPct;
        }

        return b.daysSinceStart - a.daysSinceStart;
      });
  }, [employeeCards, filter, search]);

  const filterChips: Array<{ id: FilterValue; label: string }> = [
    { id: 'all', label: t('onboarding.filter.all') },
    { id: 'attention', label: t('onboarding.filter.attention') },
    { id: 'waiting', label: t('onboarding.filter.waiting') },
    { id: 'new', label: t('onboarding.filter.new') },
  ];

  const handleStartM365Automation = async (employee: Employee) => {
    if (automationEmployeeId) {
      return;
    }

    setAutomationEmployeeId(employee.id);
    try {
      const result = await triggerOnboardingAutomation({
        employeeId: employee.id,
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
        description: `${employee.firstName} ${employee.lastName} (${result.jobId})`,
        type: 'success',
        link: '/provisioning',
        payload: {
          employeeId: employee.id,
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
      setAutomationEmployeeId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('onboarding.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {summary.active} {t('onboarding.summary.employees')}
        </p>
      </div>

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
        <>
          <Card className="overflow-hidden border-0 shadow-sm">
            <div className="grid grid-cols-2 divide-x divide-y bg-muted/20 md:grid-cols-4 md:divide-y-0">
              <div className="bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('onboarding.summary.active')}
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{summary.active}</p>
                <p className="text-xs text-muted-foreground">{t('onboarding.summary.employees')}</p>
              </div>
              <div className="bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('onboarding.summary.inProgress')}
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{summary.inProgress}</p>
                <p className="text-xs text-muted-foreground">{t('onboarding.summary.running')}</p>
              </div>
              <div className="bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('onboarding.summary.waiting')}
                </p>
                <p className="mt-1 text-2xl font-semibold text-amber-600">{summary.waiting}</p>
                <p className="text-xs text-muted-foreground">{t('onboarding.summary.external')}</p>
              </div>
              <div className="bg-card p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('onboarding.summary.needsAttention')}
                </p>
                <p className="mt-1 text-2xl font-semibold text-destructive">{summary.needsAttention}</p>
                <p className="text-xs text-muted-foreground">{t('onboarding.summary.blockers')}</p>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('onboarding.searchPlaceholder')}
                className="pl-9 pr-9"
              />
              {search && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearch('')}
                  aria-label={t('form.cancel')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {filterChips.map((chip) => (
                <Button
                  key={chip.id}
                  size="sm"
                  variant={filter === chip.id ? 'default' : 'outline'}
                  onClick={() => setFilter(chip.id)}
                >
                  {chip.label}
                </Button>
              ))}
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <p className="font-medium text-foreground">{t('employees.noEmployees')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('onboarding.emptyFiltered')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredEmployees.map((entry) => {
                const isExpanded = expandedId === entry.employee.id;
                const isTriggering = automationEmployeeId === entry.employee.id;
                const nextIsWaiting = entry.nextTaskStatus === 'waiting_external' || entry.isWaiting;
                const showM365Action = entry.hasBlocker || (!entry.hasM365Created && entry.progressPct < 100);

                const nextActionLabel = entry.hasBlocker
                  ? t('onboarding.action.retryProvisioning')
                  : entry.isNotStarted
                    ? t('onboarding.workflow.emptyTitle')
                    : entry.nextTask
                    ? t(entry.nextTask.key)
                    : t('onboarding.status.completed');

                const nextActionTag = entry.hasBlocker
                  ? t('status.failed')
                  : nextIsWaiting
                    ? t('onboarding.status.waiting')
                    : entry.isNotStarted
                      ? t('onboarding.status.pending')
                      : t('onboarding.status.inProgress');

                const nextActionToneClass = entry.hasBlocker
                  ? 'bg-destructive/10 text-destructive'
                  : nextIsWaiting
                    ? 'bg-amber-100 text-amber-700'
                    : entry.isNotStarted
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-blue-100 text-blue-700';

                return (
                  <Card
                    key={entry.employee.id}
                    className={cn(
                      'overflow-hidden border shadow-sm transition-colors',
                      entry.hasBlocker
                        ? 'border-l-4 border-l-destructive'
                        : entry.isWaiting
                          ? 'border-l-4 border-l-amber-400'
                          : 'border-l-4 border-l-transparent',
                    )}
                  >
                    <CardContent className="p-4">
                      <div
                        role="button"
                        tabIndex={0}
                        className="cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : entry.employee.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setExpandedId(isExpanded ? null : entry.employee.id);
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold',
                              departmentAvatarClass[entry.employee.department],
                            )}
                          >
                            {getInitials(entry.employee.firstName, entry.employee.lastName)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">
                                  {entry.employee.firstName} {entry.employee.lastName}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {entry.employee.role} · {entry.employee.department} · {entry.daysSinceStart}d
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <p className="text-xl font-semibold text-foreground">{entry.progressPct}%</p>
                                <ChevronRight
                                  size={16}
                                  className={cn(
                                    'shrink-0 text-muted-foreground transition-transform',
                                    isExpanded && 'rotate-90',
                                  )}
                                />
                              </div>
                            </div>

                            <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted">
                              {entry.phases.length === 0 ? (
                                <span className="h-full w-full bg-slate-300/90" />
                              ) : (
                                entry.phases.map((phase) => (
                                  <span
                                    key={phase.id}
                                    className={cn('h-full flex-1', phaseStatusClass[phase.status])}
                                    title={`${t(phase.labelKey)} (${phase.completed}/${phase.total})`}
                                  />
                                ))
                              )}
                            </div>

                            <div className="mt-3 flex items-center gap-2 border-t pt-3">
                              <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md', nextActionToneClass)}>
                                {entry.hasBlocker ? (
                                  <AlertTriangle size={14} />
                                ) : nextIsWaiting ? (
                                  <Hourglass size={14} />
                                ) : (
                                  <ArrowRight size={14} />
                                )}
                              </span>

                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  {nextIsWaiting ? t('onboarding.next.waitingOn') : t('onboarding.next.upNext')}
                                </p>
                                <p className="truncate text-sm font-medium text-foreground">{nextActionLabel}</p>
                              </div>

                              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', nextActionToneClass)}>
                                {nextActionTag}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 space-y-4 border-t pt-4">
                          {entry.phases.length > 0 ? (
                            <div className="grid gap-2 md:grid-cols-2">
                              {entry.phases.map((phase) => (
                                <div key={phase.id} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                                  <span className={cn('h-2 w-2 shrink-0 rounded-full', phaseDotClass[phase.status])} />
                                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                                    {t(phase.labelKey)}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {phase.completed}/{phase.total}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">{t('onboarding.workflow.emptyDescription')}</p>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/employees/${entry.employee.id}?tab=onboarding`);
                              }}
                            >
                              {t('onboarding.viewOnboarding')}
                            </Button>

                            {showM365Action && (
                              <Button
                                size="sm"
                                variant={entry.hasBlocker ? 'destructive' : 'default'}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleStartM365Automation(entry.employee);
                                }}
                                disabled={Boolean(automationEmployeeId)}
                                className="gap-2"
                              >
                                {entry.hasBlocker ? <RotateCcw size={14} /> : <Zap size={14} />}
                                {isTriggering
                                  ? t('onboarding.triggering')
                                  : entry.hasBlocker
                                    ? t('onboarding.action.retryProvisioning')
                                    : t('onboarding.startAutomation')}
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OnboardingPage;
