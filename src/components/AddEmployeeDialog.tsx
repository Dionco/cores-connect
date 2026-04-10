import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CalendarIcon, CheckCircle2, Eye, Loader2, Mail, Pencil, Shield, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { contractTypes, departments } from '@/data/mockData';
import { createAppNotification } from '@/lib/notifications';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useInvalidateEmployees } from '@/hooks/useEmployees';
import {
  createEmployeeRecord,
  fetchGraphResources,
  fetchProvisioningJobLogs,
  initializeOnboardingWorkflow,
  triggerOnboardingAutomation,
} from '@/lib/automation/client';
import type { ProvisioningJobLog } from '@/lib/automation/client';
import {
  buildSecurityGroupSections,
  getSecurityGroupDisplayLabel,
  normalizeSecurityGroup,
} from '@/lib/automation/securityGroups';
import type { GraphSecurityGroup, GraphSharedMailbox } from '@/lib/automation/types';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = 1 | 2 | 3 | 4;
type DialogView = 'wizard' | 'success' | 'error';

type ValidationErrors = Record<'firstName' | 'lastName' | 'role' | 'department', boolean>;

const STEP_TITLES: Record<WizardStep, string> = {
  1: 'Employee Details',
  2: 'Shared Mailboxes',
  3: 'Security Groups',
  4: 'Review & Create',
};
const WIZARD_STEPS: WizardStep[] = [1, 2, 3, 4];

const slugify = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

const deriveWorkEmail = (firstName: string, lastName: string): string => {
  const firstInitial = slugify(firstName).slice(0, 1);
  const normalizedLastName = slugify(lastName);

  if (!firstInitial || !normalizedLastName) {
    return '';
  }

  return `${firstInitial}${normalizedLastName}@cores.nl`;
};

const AddEmployeeDialog = ({ open, onOpenChange }: AddEmployeeDialogProps) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const invalidateEmployees = useInvalidateEmployees();

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [view, setView] = useState<DialogView>('wizard');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [workEmailOverridden, setWorkEmailOverridden] = useState(false);
  const [personalEmail, setPersonalEmail] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [startDate, setStartDate] = useState<Date>();
  const [contractType, setContractType] = useState('');
  const [workPhone, setWorkPhone] = useState('');
  const [personalPhone, setPersonalPhone] = useState('');
  const [startOnboarding, setStartOnboarding] = useState(true);

  const [selectedMailboxes, setSelectedMailboxes] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [availableMailboxes, setAvailableMailboxes] = useState<GraphSharedMailbox[]>([]);
  const [availableGroups, setAvailableGroups] = useState<GraphSecurityGroup[]>([]);

  const [isResourcesLoading, setIsResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [creationPhase, setCreationPhase] = useState<'idle' | 'record' | 'provisioning' | 'finalizing'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({
    firstName: false,
    lastName: false,
    role: false,
    department: false,
  });

  const [createdEmployeeEmail, setCreatedEmployeeEmail] = useState<string>('');
  const [createdEmployeeId, setCreatedEmployeeId] = useState<string>('');
  const [provisioningLogs, setProvisioningLogs] = useState<ProvisioningJobLog[]>([]);
  const [provisioningJobStatus, setProvisioningJobStatus] = useState<'Completed' | 'Failed' | null>(null);

  useEffect(() => {
    const suggestedEmail = deriveWorkEmail(firstName, lastName);
    if (!workEmailOverridden) {
      setWorkEmail(suggestedEmail);
    }
  }, [firstName, lastName, workEmailOverridden]);

  const resetDialogState = () => {
    setCurrentStep(1);
    setView('wizard');
    setFirstName('');
    setLastName('');
    setWorkEmail('');
    setWorkEmailOverridden(false);
    setPersonalEmail('');
    setRole('');
    setDepartment('');
    setStartDate(undefined);
    setContractType('');
    setWorkPhone('');
    setPersonalPhone('');
    setStartOnboarding(true);
    setSelectedMailboxes([]);
    setSelectedGroupIds([]);
    setAvailableMailboxes([]);
    setAvailableGroups([]);
    setIsResourcesLoading(false);
    setResourcesError(null);
    setIsCreating(false);
    setCreationPhase('idle');
    setErrorMessage(null);
    setErrors({ firstName: false, lastName: false, role: false, department: false });
    setCreatedEmployeeEmail('');
    setCreatedEmployeeId('');
    setProvisioningLogs([]);
    setProvisioningJobStatus(null);
  };

  const loadGraphResources = async () => {
    setIsResourcesLoading(true);
    setResourcesError(null);

    try {
      const resources = await fetchGraphResources();
      setAvailableMailboxes(resources.sharedMailboxes);
      setAvailableGroups(resources.securityGroups);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load Microsoft Graph resources.';
      setResourcesError(message);
      setAvailableMailboxes([]);
      setAvailableGroups([]);
    } finally {
      setIsResourcesLoading(false);
    }
  };

  useEffect(() => {
    if (open && startOnboarding) {
      void loadGraphResources();
    }
  }, [open, startOnboarding]);

  const closeAndReset = (navigateToOnboarding = false) => {
    const targetEmployeeId = createdEmployeeId;
    onOpenChange(false);
    resetDialogState();

    if (navigateToOnboarding && targetEmployeeId) {
      navigate(`/employees/${targetEmployeeId}?tab=onboarding`);
    }
  };

  const validateStepOne = (): boolean => {
    const nextErrors: ValidationErrors = {
      firstName: !firstName.trim(),
      lastName: !lastName.trim(),
      role: !role.trim(),
      department: !department,
    };

    setErrors(nextErrors);

    return !Object.values(nextErrors).some(Boolean);
  };

  const nextStep = () => {
    if (currentStep === 1 && !validateStepOne()) {
      return;
    }

    if (currentStep === 1 && !startOnboarding) {
      setErrorMessage(null);
      setView('wizard');
      setCurrentStep(4);
      return;
    }

    setErrorMessage(null);
    setView('wizard');
    setCurrentStep((prev) => Math.min(prev + 1, 4) as WizardStep);
  };

  const previousStep = () => {
    if (currentStep === 4 && !startOnboarding) {
      setErrorMessage(null);
      setView('wizard');
      setCurrentStep(1);
      return;
    }

    setErrorMessage(null);
    setView('wizard');
    setCurrentStep((prev) => Math.max(prev - 1, 1) as WizardStep);
  };

  const toggleMailboxSelection = (email: string, checked: boolean) => {
    setSelectedMailboxes((prev) =>
      checked ? [...prev, email] : prev.filter((value) => value !== email),
    );
  };

  const toggleGroupSelection = (id: string, checked: boolean) => {
    setSelectedGroupIds((prev) =>
      checked ? [...prev, id] : prev.filter((value) => value !== id),
    );
  };

  const selectedMailboxLabels = useMemo(() => {
    const labelMap = new Map(availableMailboxes.map((mailbox) => [mailbox.email, mailbox.displayName]));
    return selectedMailboxes.map((email) => ({
      key: email,
      label: `${labelMap.get(email) || email} (${email})`,
    }));
  }, [availableMailboxes, selectedMailboxes]);

  const securityGroupSections = useMemo(
    () => buildSecurityGroupSections(availableGroups),
    [availableGroups],
  );

  const normalizedGroupMap = useMemo(
    () =>
      new Map(
        availableGroups.map((group) => {
          const normalized = normalizeSecurityGroup(group);
          return [group.id, normalized] as const;
        }),
      ),
    [availableGroups],
  );

  const selectedGroupLabels = useMemo(() => {
    return selectedGroupIds.map((id) => ({
      key: id,
      label: normalizedGroupMap.has(id)
        ? getSecurityGroupDisplayLabel(normalizedGroupMap.get(id)!, {
          read: t('addEmployee.securityGroups.permission.read'),
          edit: t('addEmployee.securityGroups.permission.edit'),
        })
        : id,
    }));
  }, [normalizedGroupMap, selectedGroupIds, t]);

  const visibleWizardSteps = useMemo<WizardStep[]>(
    () => (startOnboarding ? WIZARD_STEPS : [1, 4]),
    [startOnboarding],
  );
  const currentVisibleStepIndex = Math.max(visibleWizardSteps.indexOf(currentStep), 0);
  const isOnFinalVisibleStep = currentStep === visibleWizardSteps[visibleWizardSteps.length - 1];

  useEffect(() => {
    if (!startOnboarding && (currentStep === 2 || currentStep === 3)) {
      setCurrentStep(4);
    }
  }, [currentStep, startOnboarding]);

  const handleCreateAccount = async () => {
    if (isCreating) {
      return;
    }

    setIsCreating(true);
    setCreationPhase('record');
    setErrorMessage(null);
    setView('wizard');

    try {
      const createdEmployee = await createEmployeeRecord({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        workEmail: workEmail.trim(),
        personalEmail: personalEmail.trim(),
        role: role.trim(),
        department,
        startDate: format(startDate || new Date(), 'yyyy-MM-dd'),
        contractType: contractType || 'Permanent',
        workPhone: workPhone.trim(),
        personalPhone: personalPhone.trim(),
      });

      const resolvedEmail = createdEmployee.email || deriveWorkEmail(firstName, lastName);
      setCreatedEmployeeEmail(resolvedEmail);
      setCreatedEmployeeId(createdEmployee.id);

      if (!startOnboarding) {
        try {
          await initializeOnboardingWorkflow({
            employeeId: createdEmployee.id,
          });
        } catch (initError) {
          const initMessage = initError instanceof Error ? initError.message : 'Failed to initialize onboarding workflow.';
          toast({
            title: 'Onboarding initialization failed',
            description: `${firstName} ${lastName} was created, but onboarding setup failed: ${initMessage}`,
            variant: 'destructive',
          });
        }

        setCreationPhase('finalizing');
        setProvisioningLogs([]);
        setProvisioningJobStatus(null);

        void invalidateEmployees();
        setView('success');

        toast({
          title: 'Employee created',
          description: `${firstName} ${lastName} was created. Onboarding automation was not started.`,
          variant: 'default',
        });

        void createAppNotification({
          title: 'Employee created',
          description: `${firstName} ${lastName} (${resolvedEmail})`,
          type: 'info',
          link: '/employees',
          payload: {
            employeeId: createdEmployee.id,
            onboardingStarted: false,
          },
        });

        return;
      }

      setCreationPhase('provisioning');

      const automationResult = await triggerOnboardingAutomation({
        employeeId: createdEmployee.id,
        service: 'M365',
        selectedMailboxes,
        selectedGroupIds,
      });

      try {
        await initializeOnboardingWorkflow({
          employeeId: createdEmployee.id,
          provisioningStatus:
            automationResult.status === 'Completed'
              ? 'completed'
              : automationResult.status === 'Failed'
                ? 'failed'
                : 'running',
        });
      } catch (initError) {
        const initMessage = initError instanceof Error ? initError.message : 'Failed to initialize onboarding workflow.';
        toast({
          title: 'Onboarding initialization failed',
          description: `${firstName} ${lastName} account was provisioned, but onboarding setup failed: ${initMessage}`,
          variant: 'destructive',
        });
      }

      setCreationPhase('finalizing');

      // Fetch detailed provisioning logs to show per-step results
      const logs = await fetchProvisioningJobLogs(automationResult.jobId);
      setProvisioningLogs(logs);
      setProvisioningJobStatus(automationResult.status === 'Completed' ? 'Completed' : 'Failed');

      void invalidateEmployees();
      setView('success');

      const hasErrors = logs.some((log) => log.status === 'error');
      toast({
        title: hasErrors ? 'Account created with warnings' : 'Account created',
        description: hasErrors
          ? `${firstName} ${lastName} was provisioned but some steps had issues.`
          : `${firstName} ${lastName} was provisioned successfully.`,
        variant: hasErrors ? 'destructive' : 'default',
      });

      void createAppNotification({
        title: hasErrors ? 'M365 account provisioned with warnings' : 'M365 account provisioned',
        description: `${firstName} ${lastName} (${resolvedEmail})`,
        type: hasErrors ? 'warning' : 'success',
        link: '/provisioning',
        payload: {
          employeeId: createdEmployee.id,
          selectedMailboxes,
          selectedGroupIds,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create account.';
      setErrorMessage(message);
      setView('error');
    } finally {
      setIsCreating(false);
    }
  };

  const renderStepOne = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t('form.firstName')} *</Label>
          <Input
            value={firstName}
            onChange={(event) => {
              setFirstName(event.target.value);
              setErrors((prev) => ({ ...prev, firstName: false }));
            }}
            className={errors.firstName ? 'border-destructive' : ''}
          />
          {errors.firstName && <p className="mt-1 text-xs text-destructive">{t('form.required')}</p>}
        </div>
        <div>
          <Label className="text-xs">{t('form.lastName')} *</Label>
          <Input
            value={lastName}
            onChange={(event) => {
              setLastName(event.target.value);
              setErrors((prev) => ({ ...prev, lastName: false }));
            }}
            className={errors.lastName ? 'border-destructive' : ''}
          />
          {errors.lastName && <p className="mt-1 text-xs text-destructive">{t('form.required')}</p>}
        </div>
      </div>

      <div>
        <Label className="text-xs">Work Email</Label>
        <Input
          type="email"
          value={workEmail}
          onChange={(event) => {
            setWorkEmail(event.target.value);
            setWorkEmailOverridden(true);
          }}
          placeholder="jdoe@cores.nl"
        />
      </div>

      <div>
        <Label className="text-xs">{t('form.personalEmail')}</Label>
        <Input
          type="email"
          value={personalEmail}
          onChange={(event) => setPersonalEmail(event.target.value)}
        />
      </div>

      <div>
        <Label className="text-xs">{t('form.role')} *</Label>
        <Input
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setErrors((prev) => ({ ...prev, role: false }));
          }}
          className={errors.role ? 'border-destructive' : ''}
        />
        {errors.role && <p className="mt-1 text-xs text-destructive">{t('form.required')}</p>}
      </div>

      <div>
        <Label className="text-xs">{t('form.department')} *</Label>
        <Select
          value={department}
          onValueChange={(value) => {
            setDepartment(value);
            setErrors((prev) => ({ ...prev, department: false }));
          }}
        >
          <SelectTrigger className={errors.department ? 'border-destructive' : ''}>
            <SelectValue placeholder="Select a department" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((entry) => (
              <SelectItem key={entry} value={entry}>{entry}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.department && <p className="mt-1 text-xs text-destructive">{t('form.required')}</p>}
      </div>

      <div>
        <Label className="text-xs">{t('form.startDate')}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={setStartDate}
              className="pointer-events-auto p-3"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label className="text-xs">{t('form.contractType')}</Label>
        <Select value={contractType} onValueChange={setContractType}>
          <SelectTrigger>
            <SelectValue placeholder="Select contract type" />
          </SelectTrigger>
          <SelectContent>
            {contractTypes.map((entry) => (
              <SelectItem key={entry} value={entry}>{entry}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t('form.workPhone')}</Label>
          <Input value={workPhone} onChange={(event) => setWorkPhone(event.target.value)} />
        </div>
        <div>
          <Label className="text-xs">{t('form.personalPhone')}</Label>
          <Input value={personalPhone} onChange={(event) => setPersonalPhone(event.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            checked={startOnboarding}
            onCheckedChange={(value) => setStartOnboarding(Boolean(value))}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <p className="text-sm font-medium">Start Microsoft 365 onboarding</p>
            <p className="text-xs text-muted-foreground">
              When enabled, this employee goes through Microsoft account provisioning now. If disabled, only the employee record is created.
            </p>
          </div>
        </label>
      </div>
    </div>
  );

  const renderResourceSkeleton = () => (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );

  const renderStepTwo = () => (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Select shared mailboxes to assign to this employee.</p>

      {isResourcesLoading && renderResourceSkeleton()}

      {!isResourcesLoading && resourcesError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <div className="font-semibold mb-2">Failed to load shared mailboxes</div>
          <p className="text-xs mb-2">{resourcesError}</p>
          <p className="text-xs text-destructive/80 mb-3">
            This may indicate that the Microsoft Graph API is misconfigured or lacks the necessary permissions (Exchange.ManageAsApp).
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void loadGraphResources()}>
            Retry Loading
          </Button>
        </div>
      )}

      {!isResourcesLoading && !resourcesError && availableMailboxes.length === 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <div className="font-semibold mb-2">No shared mailboxes available</div>
          <p className="text-xs">
            No shared mailboxes were found. This could mean:
          </p>
          <ul className="text-xs list-disc list-inside mt-2 space-y-1">
            <li>No shared mailboxes exist in your organization</li>
            <li>The configured mailboxes (MS_EXO_SHARED_MAILBOX_* env vars) are not found</li>
            <li>The API permissions or configuration needs adjustment</li>
          </ul>
        </div>
      )}

      {!isResourcesLoading && !resourcesError && availableMailboxes.length > 0 && (
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-3">
          {availableMailboxes.map((mailbox) => {
            const checked = selectedMailboxes.includes(mailbox.email);

            return (
              <label key={mailbox.email} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/40">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => toggleMailboxSelection(mailbox.email, Boolean(value))}
                />
                <div>
                  <p className="text-sm font-medium">{mailbox.displayName}</p>
                  <p className="text-xs text-muted-foreground">{mailbox.email}</p>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderStepThree = () => (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('addEmployee.securityGroups.help')}</p>

      {isResourcesLoading && renderResourceSkeleton()}

      {!isResourcesLoading && resourcesError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <p>{resourcesError}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void loadGraphResources()}>
            Retry
          </Button>
        </div>
      )}

      {!isResourcesLoading && !resourcesError && availableGroups.length === 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          {t('addEmployee.securityGroups.none')}
        </div>
      )}

      {!isResourcesLoading && !resourcesError && availableGroups.length > 0 && (
        <div className="max-h-56 space-y-4 overflow-y-auto rounded-lg border p-3">
          {securityGroupSections.sharepoint.length > 0 ? (
            securityGroupSections.sharepoint.map((section) => (
              <div key={section.folderLabel} className="flex items-center justify-between gap-3 rounded-md border p-2">
                <p className="text-sm font-medium">{section.folderLabel}</p>

                <div className="flex items-center gap-2">
                  {(['read', 'edit'] as const).map((permission) => {
                    const group = section.items.find((item) => item.permission === permission);
                    const checked = group ? selectedGroupIds.includes(group.id) : false;
                    const permissionLabel = permission === 'read'
                      ? t('addEmployee.securityGroups.permission.read')
                      : t('addEmployee.securityGroups.permission.edit');
                    const Icon = permission === 'read' ? Eye : Pencil;

                    return (
                      <button
                        key={`${section.folderLabel}-${permission}`}
                        type="button"
                        aria-pressed={checked}
                        disabled={!group}
                        onClick={() => {
                          if (group) {
                            toggleGroupSelection(group.id, !checked);
                          }
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors',
                          group
                            ? 'hover:bg-muted/40'
                            : 'cursor-not-allowed opacity-50',
                          checked && permission === 'read' && 'border-sky-300 bg-sky-50 text-sky-800',
                          checked && permission === 'edit' && 'border-emerald-300 bg-emerald-50 text-emerald-800',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{permissionLabel}</span>
                        <span
                          className={cn(
                            'inline-flex h-4 w-4 items-center justify-center rounded-sm border',
                            checked && permission === 'read' && 'border-sky-500 bg-sky-100 text-sky-700',
                            checked && permission === 'edit' && 'border-emerald-500 bg-emerald-100 text-emerald-700',
                          )}
                          aria-hidden="true"
                        >
                          {checked && <CheckCircle2 className="h-3 w-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-md bg-muted/30 p-2 text-sm text-muted-foreground">
              {t('addEmployee.securityGroups.noneMatched')}
            </p>
          )}

          {securityGroupSections.other.length > 0 && (
            <div className={cn('space-y-1.5', securityGroupSections.sharepoint.length > 0 && 'border-t pt-3')}>
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('addEmployee.securityGroups.otherSection')}
              </p>

              {securityGroupSections.other.map((group) => {
                const checked = selectedGroupIds.includes(group.id);

                return (
                  <label key={group.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/40">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleGroupSelection(group.id, Boolean(value))}
                    />
                    <p className="text-sm font-medium">{group.originalDisplayName}</p>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderCreationProgress = () => {
    const creationSteps = startOnboarding
      ? [
        { phase: 'record' as const, label: 'Creating employee record' },
        { phase: 'provisioning' as const, label: 'Provisioning Microsoft 365 account' },
        { phase: 'finalizing' as const, label: 'Finalizing setup' },
      ]
      : [
        { phase: 'record' as const, label: 'Creating employee record' },
        { phase: 'finalizing' as const, label: 'Finalizing setup' },
      ];

    const phaseOrder = creationSteps.map((step) => step.phase);
    const currentIndex = creationPhase === 'idle' ? -1 : phaseOrder.indexOf(creationPhase);

    return (
      <div className="space-y-4 py-2">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm font-semibold">
            {startOnboarding ? `Setting up ${firstName} ${lastName}` : `Creating ${firstName} ${lastName}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {startOnboarding
              ? 'This may take up to a minute - please do not close this dialog.'
              : 'This usually takes a few seconds.'}
          </p>
        </div>

        <div className="space-y-2 rounded-lg border p-4">
          {creationSteps.map((step, index) => {
            const isActive = step.phase === creationPhase;
            const isComplete = currentIndex > -1 && index < currentIndex;
            const isPending = currentIndex === -1 || index > currentIndex;

            return (
              <div key={step.phase} className="flex items-center gap-3">
                {isComplete && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                {isActive && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />}
                {isPending && <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted" />}
                <span className={cn(
                  'text-sm',
                  isActive && 'font-medium text-foreground',
                  isComplete && 'text-muted-foreground',
                  isPending && 'text-muted-foreground/60',
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderStepFour = () => {
    if (isCreating) {
      return renderCreationProgress();
    }

    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-3">
          <h3 className="mb-2 text-sm font-semibold">Employee</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{firstName} {lastName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Work Email</dt>
              <dd>{workEmail || 'Auto-generated on create'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Role</dt>
              <dd>{role}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Department</dt>
              <dd>{department}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Start Date</dt>
              <dd>{startDate ? format(startDate, 'PPP') : 'Not set'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Start onboarding now</dt>
              <dd>{startOnboarding ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </div>

        {startOnboarding ? (
          <>
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Mail size={14} /> Shared Mailboxes
              </div>
              {selectedMailboxLabels.length === 0 ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {selectedMailboxLabels.map((mailbox) => <li key={mailbox.key}>{mailbox.label}</li>)}
                </ul>
              )}
            </div>

            <div className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Shield size={14} /> Security Groups
              </div>
              {selectedGroupLabels.length === 0 ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {selectedGroupLabels.map((group) => <li key={group.key}>{group.label}</li>)}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-muted bg-muted/20 p-3 text-sm text-muted-foreground">
            Microsoft 365 onboarding is turned off. Shared mailbox and security group assignment will be skipped.
          </div>
        )}

        {errorMessage && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}
      </div>
    );
  };

  const renderWizardContent = () => {
    if (currentStep === 1) {
      return renderStepOne();
    }

    if (!startOnboarding) {
      return renderStepFour();
    }

    if (currentStep === 2) {
      return renderStepTwo();
    }

    if (currentStep === 3) {
      return renderStepThree();
    }

    return renderStepFour();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeAndReset();
          return;
        }

        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {view === 'success' ? (
          (() => {
            if (!startOnboarding) {
              return (
                <div className="space-y-5 py-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 size={24} />
                  </div>

                  <div className="text-center">
                    <h2 className="text-xl font-semibold">Employee created</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {createdEmployeeEmail || workEmail || deriveWorkEmail(firstName, lastName)}
                    </p>
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="text-sm">
                      <div className="flex justify-between gap-4 py-2 border-b">
                        <span className="font-semibold">Employee</span>
                        <span>{firstName} {lastName}</span>
                      </div>
                      <div className="flex justify-between gap-4 py-2 border-b">
                        <span className="font-semibold">Department</span>
                        <span>{department}</span>
                      </div>
                      <div className="flex justify-between gap-4 py-2">
                        <span className="font-semibold">Onboarding</span>
                        <span className="font-medium text-muted-foreground">Not started</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/30">
                    Microsoft 365 onboarding was not started for this employee. You can start provisioning later from the provisioning flow.
                  </p>

                  <Button className="w-full" onClick={() => closeAndReset(true)}>Done</Button>
                </div>
              );
            }

            const errorLogs = provisioningLogs.filter((l) => l.status === 'error');
            const successLogs = provisioningLogs.filter(
              (l) => l.status === 'done' && !l.step.startsWith('Job queued') && !l.step.startsWith('Worker started'),
            );
            const hasErrors = errorLogs.length > 0;

            // Categorize logs for display
            const categorize = (log: ProvisioningJobLog) => {
              const s = log.step.toLowerCase();
              if (s.includes('m365 account') || s.includes('m365 user')) return 'account';
              if (s.includes('licence') || s.includes('license')) return 'license';
              if (s.includes('shared mailbox') || s.includes('mailbox')) return 'mailbox';
              if (s.includes('sharepoint')) return 'sharepoint';
              if (s.includes('security group')) return 'group';
              return 'other';
            };

            const mailboxLogs = provisioningLogs.filter((l) => categorize(l) === 'mailbox');
            const groupLogs = provisioningLogs.filter((l) => categorize(l) === 'group');
            const sharepointLogs = provisioningLogs.filter((l) => categorize(l) === 'sharepoint');
            const accountLogs = provisioningLogs.filter((l) => categorize(l) === 'account');
            const licenseLogs = provisioningLogs.filter((l) => categorize(l) === 'license');

            const renderLogIcon = (status: string) =>
              status === 'error'
                ? <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />;

            const renderLogSection = (
              title: string,
              icon: React.ReactNode,
              logs: ProvisioningJobLog[],
            ) => {
              if (logs.length === 0) return null;
              const sectionHasErrors = logs.some((l) => l.status === 'error');
              return (
                <div className={cn(
                  'space-y-2 rounded-lg border p-4',
                  sectionHasErrors
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-emerald-200 bg-emerald-50',
                )}>
                  <div className="flex items-center gap-2">
                    {icon}
                    <p className={cn('text-sm font-semibold', sectionHasErrors ? 'text-amber-900' : 'text-emerald-900')}>
                      {title}
                    </p>
                    {sectionHasErrors && (
                      <span className="ml-auto rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        Issues detected
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {logs.map((log, i) => (
                      <li key={i} className="flex items-start gap-2">
                        {renderLogIcon(log.status)}
                        <span className={cn(
                          'text-xs leading-relaxed',
                          log.status === 'error' ? 'text-destructive' : sectionHasErrors ? 'text-amber-800' : 'text-emerald-800',
                        )}>
                          {log.step}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            };

            return (
              <div className="space-y-5 py-3">
                <div className={cn(
                  'mx-auto flex h-12 w-12 items-center justify-center rounded-full',
                  hasErrors ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
                )}>
                  {hasErrors ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                </div>

                <div className="text-center">
                  <h2 className="text-xl font-semibold">
                    {hasErrors ? 'Account created with warnings' : 'Account created successfully'}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {createdEmployeeEmail || workEmail || deriveWorkEmail(firstName, lastName)}
                  </p>
                </div>

                {hasErrors && (
                  <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <div className="text-xs text-amber-800">
                      <p className="font-semibold">
                        {errorLogs.length} provisioning step{errorLogs.length === 1 ? '' : 's'} failed
                      </p>
                      <p className="mt-0.5">
                        The employee account was created but some assignments could not be completed.
                        Check the details below and retry from the Provisioning page if needed.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="text-sm">
                    <div className="flex justify-between gap-4 py-2 border-b">
                      <span className="font-semibold">Employee</span>
                      <span>{firstName} {lastName}</span>
                    </div>
                    <div className="flex justify-between gap-4 py-2 border-b">
                      <span className="font-semibold">Department</span>
                      <span>{department}</span>
                    </div>
                    <div className="flex justify-between gap-4 py-2">
                      <span className="font-semibold">Status</span>
                      <span className={cn('font-medium', hasErrors ? 'text-amber-600' : 'text-emerald-600')}>
                        {hasErrors ? 'Provisioned with warnings' : 'Provisioned'}
                      </span>
                    </div>
                  </div>
                </div>

                {provisioningLogs.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Provisioning Results ({successLogs.length} done, {errorLogs.length} failed)
                    </p>

                    {renderLogSection('M365 Account', <Mail className={accountLogs.some(l => l.status === 'error') ? 'text-amber-600' : 'text-emerald-600'} size={16} />, accountLogs)}
                    {renderLogSection('License', <CheckCircle2 className={licenseLogs.some(l => l.status === 'error') ? 'text-amber-600' : 'text-emerald-600'} size={16} />, licenseLogs)}
                    {renderLogSection('Shared Mailboxes', <Mail className={mailboxLogs.some(l => l.status === 'error') ? 'text-amber-600' : 'text-emerald-600'} size={16} />, mailboxLogs)}
                    {renderLogSection('SharePoint', <Shield className={sharepointLogs.some(l => l.status === 'error') ? 'text-amber-600' : 'text-emerald-600'} size={16} />, sharepointLogs)}
                    {renderLogSection('Security Groups', <Shield className={groupLogs.some(l => l.status === 'error') ? 'text-amber-600' : 'text-emerald-600'} size={16} />, groupLogs)}
                  </div>
                ) : (
                  <>
                    {selectedMailboxLabels.length > 0 && (
                      <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-center gap-2">
                          <Mail className="text-emerald-600" size={16} />
                          <p className="text-sm font-semibold text-emerald-900">Shared Mailboxes</p>
                        </div>
                        <ul className="space-y-1">
                          {selectedMailboxLabels.map((mailbox) => (
                            <li key={mailbox.key} className="text-xs text-emerald-800">
                              <span className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {mailbox.label}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedGroupLabels.length > 0 && (
                      <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-center gap-2">
                          <Shield className="text-emerald-600" size={16} />
                          <p className="text-sm font-semibold text-emerald-900">Security Groups</p>
                        </div>
                        <ul className="space-y-1">
                          {selectedGroupLabels.map((group) => (
                            <li key={group.key} className="text-xs text-emerald-800">
                              <span className="flex items-center gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {group.label}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                <p className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/30">
                  {hasErrors
                    ? <>Some provisioning steps failed. Visit the{' '}
                        <a href="/provisioning" className="font-semibold underline">Provisioning page</a> to retry failed steps or review detailed logs.</>
                    : <>All provisioning steps completed. Check the{' '}
                        <a href="/provisioning" className="font-semibold underline">Provisioning page</a> for detailed logs.</>}
                </p>

                <Button className="w-full" onClick={() => closeAndReset(true)}>Done</Button>
              </div>
            );
          })()

        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">{t('employees.addNew')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Progress value={((currentVisibleStepIndex + 1) / visibleWizardSteps.length) * 100} className="h-2" />

              <div className={cn('grid gap-2', visibleWizardSteps.length === 4 ? 'grid-cols-4' : 'grid-cols-2')}>
                {visibleWizardSteps.map((step, index) => {
                  const isActive = currentStep === step;
                  const isComplete = currentVisibleStepIndex > index;

                  return (
                    <button
                      key={step}
                      type="button"
                      className={cn(
                        'rounded-md border px-2 py-2 text-left transition-colors',
                        isActive && 'border-primary bg-primary/10',
                        isComplete && 'border-emerald-300 bg-emerald-50',
                      )}
                      disabled={isCreating}
                      onClick={() => {
                        if (index <= currentVisibleStepIndex) {
                          setCurrentStep(step);
                        }
                      }}
                    >
                      <p className="text-xs font-semibold">Step {index + 1}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{STEP_TITLES[step]}</p>
                    </button>
                  );
                })}
              </div>

              {renderWizardContent()}

              {!isCreating && (
                <>
                  <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
                    <Button variant="outline" onClick={() => closeAndReset()}>
                      {t('form.cancel')}
                    </Button>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={previousStep}
                        disabled={currentVisibleStepIndex === 0}
                      >
                        Back
                      </Button>

                      {!isOnFinalVisibleStep ? (
                        <Button onClick={nextStep}>
                          {currentStep === 1 && !startOnboarding ? 'Review' : 'Next'}
                        </Button>
                      ) : (
                        <Button onClick={handleCreateAccount}>
                          {errorMessage ? 'Try Again' : 'Create Account'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {isOnFinalVisibleStep && (
                    startOnboarding ? (
                      <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-cores-orange" />
                        <p className="text-xs leading-relaxed text-foreground">
                          Creating the account runs Microsoft 365 provisioning synchronously and can take a moment.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-muted bg-muted/20 p-3">
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Creating the account will only add the employee record. Microsoft 365 onboarding will not start.
                        </p>
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddEmployeeDialog;
