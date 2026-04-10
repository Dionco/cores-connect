import type { OnboardingPhaseTemplate, OnboardingTaskTemplate } from './onboardingTypes';

// ---------------------------------------------------------------------------
// Departments that qualify for Transportplan
// ---------------------------------------------------------------------------

export const TRANSPORTPLAN_DEPARTMENTS = [
  'Transport',
  'Operations',
  'Planning',
  'Logistics',
];

// ---------------------------------------------------------------------------
// Phase definitions
// ---------------------------------------------------------------------------

export const ONBOARDING_PHASES: OnboardingPhaseTemplate[] = [
  {
    id: 'employee-creation',
    title: 'onboarding.phase.employeeCreation',
    description: 'onboarding.phase.employeeCreation.desc',
    order: 1,
    dependsOn: [],
  },
  {
    id: 'horizon3-requests',
    title: 'onboarding.phase.horizon3Requests',
    description: 'onboarding.phase.horizon3Requests.desc',
    order: 2,
    dependsOn: ['employee-creation'],
  },
  {
    id: 'internal-accounts',
    title: 'onboarding.phase.internalAccounts',
    description: 'onboarding.phase.internalAccounts.desc',
    order: 3,
    dependsOn: ['employee-creation'],
  },
  {
    id: 'employee-setup',
    title: 'onboarding.phase.employeeSetup',
    description: 'onboarding.phase.employeeSetup.desc',
    order: 4,
    dependsOn: ['horizon3-requests', 'internal-accounts'],
  },
  {
    id: 'transportplan-setup',
    title: 'onboarding.phase.transportplanSetup',
    description: 'onboarding.phase.transportplanSetup.desc',
    order: 5,
    dependsOn: ['employee-setup'],
  },
  {
    id: 'system-activation',
    title: 'onboarding.phase.systemActivation',
    description: 'onboarding.phase.systemActivation.desc',
    order: 6,
    dependsOn: ['internal-accounts'],
  },
  {
    id: 'instructions-delivery',
    title: 'onboarding.phase.instructionsDelivery',
    description: 'onboarding.phase.instructionsDelivery.desc',
    order: 7,
    dependsOn: ['employee-creation'],
  },
  {
    id: 'verification',
    title: 'onboarding.phase.verification',
    description: 'onboarding.phase.verification.desc',
    order: 8,
    dependsOn: ['employee-setup', 'transportplan-setup', 'system-activation', 'instructions-delivery'],
  },
  {
    id: 'completion',
    title: 'onboarding.phase.completion',
    description: 'onboarding.phase.completion.desc',
    order: 9,
    dependsOn: ['verification'],
  },
];

// ---------------------------------------------------------------------------
// Task definitions — 35 tasks across 9 phases
// ---------------------------------------------------------------------------

export const ONBOARDING_TASKS: OnboardingTaskTemplate[] = [

  // ── Phase 1 — Employee creation ──────────────────────────────────────────

  {
    id: 'collect-employee-info',
    phaseId: 'employee-creation',
    title: 'onboarding.task.collectEmployeeInfo',
    description: 'onboarding.task.collectEmployeeInfo.desc',
    assignee: 'admin',
    order: 1,
    instructions: {
      steps: [
        'onboarding.task.collectEmployeeInfo.step1',
        'onboarding.task.collectEmployeeInfo.step2',
        'onboarding.task.collectEmployeeInfo.step3',
        'onboarding.task.collectEmployeeInfo.step4',
      ],
      notes: 'onboarding.task.collectEmployeeInfo.notes',
    },
  },

  // ── Phase 2 — Horizon3 admin requests ────────────────────────────────────

  {
    id: 'request-horizon3-m365',
    phaseId: 'horizon3-requests',
    title: 'onboarding.task.requestHorizon3M365',
    description: 'onboarding.task.requestHorizon3M365.desc',
    assignee: 'horizon3',
    order: 1,
    actionType: 'generate_email',
    instructions: {
      steps: [
        'onboarding.task.requestHorizon3M365.step1',
        'onboarding.task.requestHorizon3M365.step2',
        'onboarding.task.requestHorizon3M365.step3',
        'onboarding.task.requestHorizon3M365.step4',
      ],
      notes: 'onboarding.task.requestHorizon3M365.notes',
    },
  },
  {
    id: 'request-horizon3-cims',
    phaseId: 'horizon3-requests',
    title: 'onboarding.task.requestHorizon3Cims',
    description: 'onboarding.task.requestHorizon3Cims.desc',
    assignee: 'horizon3',
    order: 2,
    actionType: 'generate_email',
    instructions: {
      steps: [
        'onboarding.task.requestHorizon3Cims.step1',
        'onboarding.task.requestHorizon3Cims.step2',
        'onboarding.task.requestHorizon3Cims.step3',
      ],
    },
  },

  // ── Phase 3 — Internal account creation ──────────────────────────────────

  {
    id: 'provision-cores-m365',
    phaseId: 'internal-accounts',
    title: 'onboarding.task.provisionCoresM365',
    description: 'onboarding.task.provisionCoresM365.desc',
    assignee: 'admin',
    order: 1,
    automatable: true,
    actionType: 'trigger_provisioning',
    instructions: {
      steps: [
        'onboarding.task.provisionCoresM365.step1',
        'onboarding.task.provisionCoresM365.step2',
        'onboarding.task.provisionCoresM365.step3',
      ],
      notes: 'onboarding.task.provisionCoresM365.notes',
    },
  },
  {
    id: 'create-tribe-crm',
    phaseId: 'internal-accounts',
    title: 'onboarding.task.createTribeCrm',
    description: 'onboarding.task.createTribeCrm.desc',
    assignee: 'admin',
    order: 2,
    instructions: {
      steps: [
        'onboarding.task.createTribeCrm.step1',
        'onboarding.task.createTribeCrm.step2',
        'onboarding.task.createTribeCrm.step3',
        'onboarding.task.createTribeCrm.step4',
        'onboarding.task.createTribeCrm.step5',
        'onboarding.task.createTribeCrm.step6',
        'onboarding.task.createTribeCrm.step7',
      ],
    },
  },
  {
    id: 'create-slite',
    phaseId: 'internal-accounts',
    title: 'onboarding.task.createSlite',
    description: 'onboarding.task.createSlite.desc',
    assignee: 'admin',
    order: 3,
    instructions: {
      steps: [
        'onboarding.task.createSlite.step1',
        'onboarding.task.createSlite.step2',
        'onboarding.task.createSlite.step3',
        'onboarding.task.createSlite.step4',
        'onboarding.task.createSlite.step5',
      ],
    },
  },
  {
    id: 'request-transportplan',
    phaseId: 'internal-accounts',
    title: 'onboarding.task.requestTransportplan',
    description: 'onboarding.task.requestTransportplan.desc',
    assignee: 'transportplan_admin',
    order: 4,
    actionType: 'generate_email',
    condition: {
      field: 'department',
      values: TRANSPORTPLAN_DEPARTMENTS,
    },
    instructions: {
      steps: [
        'onboarding.task.requestTransportplan.step1',
        'onboarding.task.requestTransportplan.step2',
        'onboarding.task.requestTransportplan.step3',
      ],
      notes: 'onboarding.task.requestTransportplan.notes',
    },
  },
  {
    id: 'create-apple-business-manager',
    phaseId: 'internal-accounts',
    title: 'onboarding.task.createAppleBusinessManager',
    description: 'onboarding.task.createAppleBusinessManager.desc',
    assignee: 'admin',
    order: 5,
    instructions: {
      steps: [
        'onboarding.task.createAppleBusinessManager.step1',
        'onboarding.task.createAppleBusinessManager.step2',
        'onboarding.task.createAppleBusinessManager.step3',
        'onboarding.task.createAppleBusinessManager.step4',
      ],
    },
  },

  // ── Phase 4 — Employee setup (performed by admin with temp passwords) ────

  {
    id: 'obtain-temp-password-horizon3',
    phaseId: 'employee-setup',
    title: 'onboarding.task.obtainTempPasswordHorizon3',
    description: 'onboarding.task.obtainTempPasswordHorizon3.desc',
    assignee: 'admin',
    order: 1,
    instructions: {
      steps: [
        'onboarding.task.obtainTempPasswordHorizon3.step1',
        'onboarding.task.obtainTempPasswordHorizon3.step2',
      ],
      notes: 'onboarding.task.obtainTempPasswordHorizon3.notes',
    },
  },
  {
    id: 'obtain-temp-password-cores',
    phaseId: 'employee-setup',
    title: 'onboarding.task.obtainTempPasswordCores',
    description: 'onboarding.task.obtainTempPasswordCores.desc',
    assignee: 'admin',
    order: 2,
    instructions: {
      steps: [
        'onboarding.task.obtainTempPasswordCores.step1',
        'onboarding.task.obtainTempPasswordCores.step2',
      ],
      notes: 'onboarding.task.obtainTempPasswordCores.notes',
    },
  },
  {
    id: 'activate-horizon3-m365',
    phaseId: 'employee-setup',
    title: 'onboarding.task.activateHorizon3M365',
    description: 'onboarding.task.activateHorizon3M365.desc',
    assignee: 'admin',
    order: 3,
    instructions: {
      steps: [
        'onboarding.task.activateHorizon3M365.step1',
        'onboarding.task.activateHorizon3M365.step2',
        'onboarding.task.activateHorizon3M365.step3',
        'onboarding.task.activateHorizon3M365.step4',
        'onboarding.task.activateHorizon3M365.step5',
        'onboarding.task.activateHorizon3M365.step6',
      ],
    },
  },
  {
    id: 'setup-sharepoint-sync',
    phaseId: 'employee-setup',
    title: 'onboarding.task.setupSharepointSync',
    description: 'onboarding.task.setupSharepointSync.desc',
    assignee: 'admin',
    order: 4,
    instructions: {
      steps: [
        'onboarding.task.setupSharepointSync.step1',
        'onboarding.task.setupSharepointSync.step2',
        'onboarding.task.setupSharepointSync.step3',
        'onboarding.task.setupSharepointSync.step4',
        'onboarding.task.setupSharepointSync.step5',
      ],
    },
  },
  {
    id: 'setup-outlook-cores',
    phaseId: 'employee-setup',
    title: 'onboarding.task.setupOutlookCores',
    description: 'onboarding.task.setupOutlookCores.desc',
    assignee: 'admin',
    order: 5,
    instructions: {
      steps: [
        'onboarding.task.setupOutlookCores.step1',
        'onboarding.task.setupOutlookCores.step2',
        'onboarding.task.setupOutlookCores.step3',
      ],
    },
  },
  {
    id: 'setup-outlook-horizon3',
    phaseId: 'employee-setup',
    title: 'onboarding.task.setupOutlookHorizon3',
    description: 'onboarding.task.setupOutlookHorizon3.desc',
    assignee: 'admin',
    order: 6,
    instructions: {
      steps: [
        'onboarding.task.setupOutlookHorizon3.step1',
        'onboarding.task.setupOutlookHorizon3.step2',
        'onboarding.task.setupOutlookHorizon3.step3',
      ],
    },
  },
  {
    id: 'setup-shared-mailboxes',
    phaseId: 'employee-setup',
    title: 'onboarding.task.setupSharedMailboxes',
    description: 'onboarding.task.setupSharedMailboxes.desc',
    assignee: 'admin',
    order: 7,
    instructions: {
      steps: [
        'onboarding.task.setupSharedMailboxes.step1',
        'onboarding.task.setupSharedMailboxes.step2',
        'onboarding.task.setupSharedMailboxes.step3',
        'onboarding.task.setupSharedMailboxes.step4',
      ],
    },
  },
  {
    id: 'setup-email-signature',
    phaseId: 'employee-setup',
    title: 'onboarding.task.setupEmailSignature',
    description: 'onboarding.task.setupEmailSignature.desc',
    assignee: 'admin',
    order: 8,
    instructions: {
      steps: [
        'onboarding.task.setupEmailSignature.step1',
        'onboarding.task.setupEmailSignature.step2',
        'onboarding.task.setupEmailSignature.step3',
        'onboarding.task.setupEmailSignature.step4',
        'onboarding.task.setupEmailSignature.step5',
      ],
    },
  },

  // ── Phase 5 — Transportplan setup (conditional) ──────────────────────────

  {
    id: 'install-windows-app',
    phaseId: 'transportplan-setup',
    title: 'onboarding.task.installWindowsApp',
    description: 'onboarding.task.installWindowsApp.desc',
    assignee: 'employee',
    order: 1,
    condition: {
      field: 'department',
      values: TRANSPORTPLAN_DEPARTMENTS,
    },
    instructions: {
      steps: [
        'onboarding.task.installWindowsApp.step1',
        'onboarding.task.installWindowsApp.step2',
        'onboarding.task.installWindowsApp.step3',
        'onboarding.task.installWindowsApp.step4',
        'onboarding.task.installWindowsApp.step5',
        'onboarding.task.installWindowsApp.step6',
      ],
    },
  },
  {
    id: 'login-transportplan-cloud',
    phaseId: 'transportplan-setup',
    title: 'onboarding.task.loginTransportplanCloud',
    description: 'onboarding.task.loginTransportplanCloud.desc',
    assignee: 'employee',
    order: 2,
    condition: {
      field: 'department',
      values: TRANSPORTPLAN_DEPARTMENTS,
    },
    instructions: {
      steps: [
        'onboarding.task.loginTransportplanCloud.step1',
        'onboarding.task.loginTransportplanCloud.step2',
        'onboarding.task.loginTransportplanCloud.step3',
        'onboarding.task.loginTransportplanCloud.step4',
        'onboarding.task.loginTransportplanCloud.step5',
      ],
    },
  },

  // ── Phase 6 — System activation ──────────────────────────────────────────

  {
    id: 'activate-cims',
    phaseId: 'system-activation',
    title: 'onboarding.task.activateCims',
    description: 'onboarding.task.activateCims.desc',
    assignee: 'employee',
    order: 1,
    instructions: {
      steps: [
        'onboarding.task.activateCims.step1',
        'onboarding.task.activateCims.step2',
        'onboarding.task.activateCims.step3',
      ],
    },
  },
  {
    id: 'activate-tribe-crm',
    phaseId: 'system-activation',
    title: 'onboarding.task.activateTribeCrm',
    description: 'onboarding.task.activateTribeCrm.desc',
    assignee: 'employee',
    order: 2,
    instructions: {
      steps: [
        'onboarding.task.activateTribeCrm.step1',
        'onboarding.task.activateTribeCrm.step2',
        'onboarding.task.activateTribeCrm.step3',
        'onboarding.task.activateTribeCrm.step4',
      ],
    },
  },
  {
    id: 'activate-slite',
    phaseId: 'system-activation',
    title: 'onboarding.task.activateSlite',
    description: 'onboarding.task.activateSlite.desc',
    assignee: 'employee',
    order: 3,
    instructions: {
      steps: [
        'onboarding.task.activateSlite.step1',
        'onboarding.task.activateSlite.step2',
        'onboarding.task.activateSlite.step3',
        'onboarding.task.activateSlite.step4',
      ],
    },
  },

  // ── Phase 7 — Instructions delivery ──────────────────────────────────────

  {
    id: 'deliver-onboarding-docs',
    phaseId: 'instructions-delivery',
    title: 'onboarding.task.deliverOnboardingDocs',
    description: 'onboarding.task.deliverOnboardingDocs.desc',
    assignee: 'admin',
    order: 1,
    instructions: {
      steps: [
        'onboarding.task.deliverOnboardingDocs.step1',
        'onboarding.task.deliverOnboardingDocs.step2',
        'onboarding.task.deliverOnboardingDocs.step3',
        'onboarding.task.deliverOnboardingDocs.step4',
        'onboarding.task.deliverOnboardingDocs.step5',
        'onboarding.task.deliverOnboardingDocs.step6',
        'onboarding.task.deliverOnboardingDocs.step7',
        'onboarding.task.deliverOnboardingDocs.step8',
        'onboarding.task.deliverOnboardingDocs.step9',
      ],
    },
  },

  // ── Phase 8 — Final verification (static checklist) ──────────────────────

  {
    id: 'verify-horizon3-m365',
    phaseId: 'verification',
    title: 'onboarding.task.verifyHorizon3M365',
    description: 'onboarding.task.verifyHorizon3M365.desc',
    assignee: 'admin',
    order: 1,
  },
  {
    id: 'verify-sharepoint-sync',
    phaseId: 'verification',
    title: 'onboarding.task.verifySharepointSync',
    description: 'onboarding.task.verifySharepointSync.desc',
    assignee: 'admin',
    order: 2,
  },
  {
    id: 'verify-onedrive',
    phaseId: 'verification',
    title: 'onboarding.task.verifyOnedrive',
    description: 'onboarding.task.verifyOnedrive.desc',
    assignee: 'admin',
    order: 3,
  },
  {
    id: 'verify-outlook',
    phaseId: 'verification',
    title: 'onboarding.task.verifyOutlook',
    description: 'onboarding.task.verifyOutlook.desc',
    assignee: 'admin',
    order: 4,
  },
  {
    id: 'verify-shared-mailboxes',
    phaseId: 'verification',
    title: 'onboarding.task.verifySharedMailboxes',
    description: 'onboarding.task.verifySharedMailboxes.desc',
    assignee: 'admin',
    order: 5,
  },
  {
    id: 'verify-tribe-crm',
    phaseId: 'verification',
    title: 'onboarding.task.verifyTribeCrm',
    description: 'onboarding.task.verifyTribeCrm.desc',
    assignee: 'admin',
    order: 6,
  },
  {
    id: 'verify-cims',
    phaseId: 'verification',
    title: 'onboarding.task.verifyCims',
    description: 'onboarding.task.verifyCims.desc',
    assignee: 'admin',
    order: 7,
  },
  {
    id: 'verify-slite',
    phaseId: 'verification',
    title: 'onboarding.task.verifySlite',
    description: 'onboarding.task.verifySlite.desc',
    assignee: 'admin',
    order: 8,
  },
  {
    id: 'verify-transportplan',
    phaseId: 'verification',
    title: 'onboarding.task.verifyTransportplan',
    description: 'onboarding.task.verifyTransportplan.desc',
    assignee: 'admin',
    order: 9,
    condition: {
      field: 'department',
      values: TRANSPORTPLAN_DEPARTMENTS,
    },
  },
  {
    id: 'verify-windows-app',
    phaseId: 'verification',
    title: 'onboarding.task.verifyWindowsApp',
    description: 'onboarding.task.verifyWindowsApp.desc',
    assignee: 'admin',
    order: 10,
    condition: {
      field: 'department',
      values: TRANSPORTPLAN_DEPARTMENTS,
    },
  },
  {
    id: 'verify-apple-business-manager',
    phaseId: 'verification',
    title: 'onboarding.task.verifyAppleBusinessManager',
    description: 'onboarding.task.verifyAppleBusinessManager.desc',
    assignee: 'admin',
    order: 11,
  },
  {
    id: 'verify-email-signature',
    phaseId: 'verification',
    title: 'onboarding.task.verifyEmailSignature',
    description: 'onboarding.task.verifyEmailSignature.desc',
    assignee: 'admin',
    order: 12,
  },

  // ── Phase 9 — Completion ─────────────────────────────────────────────────

  {
    id: 'mark-complete',
    phaseId: 'completion',
    title: 'onboarding.task.markComplete',
    description: 'onboarding.task.markComplete.desc',
    assignee: 'admin',
    order: 1,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get all task templates belonging to a phase. */
export function getTasksForPhase(phaseId: string): OnboardingTaskTemplate[] {
  return ONBOARDING_TASKS
    .filter((t) => t.phaseId === phaseId)
    .sort((a, b) => a.order - b.order);
}

/** Get applicable tasks for an employee based on their department. */
export function getApplicableTasks(department: string): OnboardingTaskTemplate[] {
  return ONBOARDING_TASKS.filter((task) => {
    if (!task.condition) return true;
    if (task.condition.field === 'department') {
      return task.condition.values.includes(department);
    }
    return true;
  });
}

/** Check whether a phase has any applicable tasks for a department. */
export function isPhaseApplicable(phaseId: string, department: string): boolean {
  const phaseTasks = ONBOARDING_TASKS.filter((t) => t.phaseId === phaseId);
  // Phase with no conditional tasks is always applicable
  if (phaseTasks.every((t) => !t.condition)) return true;
  // Phase where ALL tasks are conditional — check if at least one matches
  if (phaseTasks.every((t) => !!t.condition)) {
    return phaseTasks.some((t) =>
      t.condition!.field === 'department' && t.condition!.values.includes(department),
    );
  }
  // Mixed — always applicable (unconditional tasks remain)
  return true;
}
