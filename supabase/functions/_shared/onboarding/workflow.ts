export type OnboardingTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'waiting_external'
  | 'completed'
  | 'skipped';

export type OnboardingWorkflowStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed';

export type ProvisioningBootstrapStatus = 'completed' | 'running' | 'failed' | undefined;

const TRANSPORTPLAN_DEPARTMENTS = new Set([
  'Transport',
  'Operations',
  'Planning',
  'Logistics',
]);

const CONDITIONAL_TASK_IDS = new Set([
  'request-transportplan',
  'install-windows-app',
  'login-transportplan-cloud',
  'verify-transportplan',
  'verify-windows-app',
]);

const ALL_TASK_TEMPLATE_IDS = [
  'collect-employee-info',
  'request-horizon3-m365',
  'request-horizon3-cims',
  'provision-cores-m365',
  'create-tribe-crm',
  'create-slite',
  'request-transportplan',
  'create-apple-business-manager',
  'obtain-temp-password-horizon3',
  'obtain-temp-password-cores',
  'activate-horizon3-m365',
  'setup-sharepoint-sync',
  'setup-outlook-cores',
  'setup-outlook-horizon3',
  'setup-shared-mailboxes',
  'setup-email-signature',
  'install-windows-app',
  'login-transportplan-cloud',
  'activate-cims',
  'activate-tribe-crm',
  'activate-slite',
  'deliver-onboarding-docs',
  'verify-horizon3-m365',
  'verify-sharepoint-sync',
  'verify-onedrive',
  'verify-outlook',
  'verify-shared-mailboxes',
  'verify-tribe-crm',
  'verify-cims',
  'verify-slite',
  'verify-transportplan',
  'verify-windows-app',
  'verify-apple-business-manager',
  'verify-email-signature',
  'mark-complete',
] as const;

export const getApplicableTaskTemplateIds = (department: string): string[] => {
  return ALL_TASK_TEMPLATE_IDS.filter((taskId) => {
    if (!CONDITIONAL_TASK_IDS.has(taskId)) {
      return true;
    }

    return TRANSPORTPLAN_DEPARTMENTS.has(department);
  });
};

export const getInitialTaskStatus = (
  taskTemplateId: string,
  provisioningStatus?: ProvisioningBootstrapStatus,
): OnboardingTaskStatus => {
  if (taskTemplateId === 'collect-employee-info') {
    return 'completed';
  }

  if (taskTemplateId === 'provision-cores-m365') {
    if (provisioningStatus === 'completed') {
      return 'completed';
    }

    if (provisioningStatus === 'running') {
      return 'in_progress';
    }
  }

  return 'pending';
};

export const deriveWorkflowStatus = (
  statuses: OnboardingTaskStatus[],
): OnboardingWorkflowStatus => {
  const active = statuses.filter((status) => status !== 'skipped');

  if (active.length === 0 || active.every((status) => status === 'completed')) {
    return 'completed';
  }

  if (active.some((status) => status !== 'pending')) {
    return 'in_progress';
  }

  return 'not_started';
};
