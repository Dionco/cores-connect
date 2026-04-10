import type { AppNotification } from '@/types/notifications';

export type Department = 'Sales' | 'Customs & Compliance' | 'Transport';
export type EmployeeStatus = 'Active' | 'Inactive' | 'Onboarding';
export type ContractType = 'Permanent' | 'Intern' | 'Freelance';
export type ProvisioningStatus = 'Provisioned' | 'Pending' | 'Failed';
export type JobStatus = 'Queued' | 'Running' | 'Completed' | 'Failed';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  personalEmail: string;
  role: string;
  department: Department;
  startDate: string;
  contractType: ContractType;
  workPhone: string;
  personalPhone: string;
  status: EmployeeStatus;
  provisioningStatus: ProvisioningStatus;
  avatar?: string;
  onboardingTasks: OnboardingTask[];
  provisioningItems: ProvisioningItem[];
}

export interface OnboardingTask {
  id: string;
  key: string;
  completed: boolean;
  automated: boolean;
  completedAt?: string;
  departmentSpecific?: Department;
}

export interface ProvisioningItem {
  id: string;
  label: string;
  completed: boolean;
  timestamp?: string;
  service: 'M365' | 'Apple';
}

export interface ProvisioningJob {
  id: string;
  employeeId: string;
  employeeName: string;
  service: 'M365' | 'Apple ID';
  status: JobStatus;
  triggeredAt: string;
  completedAt?: string;
  logs: { step: string; timestamp: string; status: 'done' | 'pending' | 'error' }[];
}

const createOnboardingTasks = (department: Department): OnboardingTask[] => {
  const baseTasks: OnboardingTask[] = [
    { id: '1', key: 'task.m365Created', completed: true, automated: true, completedAt: '2026-03-15 09:00' },
    { id: '2', key: 'task.licenseAssigned', completed: true, automated: true, completedAt: '2026-03-15 09:01' },
    { id: '3', key: 'task.emailConfigured', completed: true, automated: true, completedAt: '2026-03-15 09:02' },
    { id: '4', key: 'task.sharedMailboxTrading', completed: true, automated: true, completedAt: '2026-03-15 09:03' },
  ];

  if (department === 'Sales') {
    baseTasks.push({ id: '5s', key: 'task.sharedMailboxSales', completed: true, automated: true, completedAt: '2026-03-15 09:03', departmentSpecific: 'Sales' });
  } else if (department === 'Customs & Compliance') {
    baseTasks.push({ id: '5c', key: 'task.sharedMailboxCustoms', completed: true, automated: true, completedAt: '2026-03-15 09:03', departmentSpecific: 'Customs & Compliance' });
  } else if (department === 'Transport') {
    baseTasks.push({ id: '5l', key: 'task.sharedMailboxTransport', completed: true, automated: true, completedAt: '2026-03-15 09:03', departmentSpecific: 'Transport' });
  }

  baseTasks.push(
    { id: '6', key: 'task.sharepointGroup', completed: true, automated: true, completedAt: '2026-03-15 09:04' },
    { id: '7', key: 'task.appleBusinessManager', completed: true, automated: true, completedAt: '2026-03-15 09:05' },
    { id: '8', key: 'task.loginPdf', completed: false, automated: false },
    { id: '9', key: 'task.sliteInvite', completed: false, automated: false },
    { id: '10', key: 'task.tribeCrmInvite', completed: false, automated: false },
  );

  return baseTasks;
};

const createProvisioningItems = (firstName: string): ProvisioningItem[] => [
  { id: 'p1', label: 'Email created', completed: true, timestamp: '2026-03-15 09:00', service: 'M365' },
  { id: 'p2', label: 'Business Premium licence assigned', completed: true, timestamp: '2026-03-15 09:01', service: 'M365' },
  { id: 'p3', label: 'Shared mailboxes added', completed: true, timestamp: '2026-03-15 09:03', service: 'M365' },
  { id: 'p4', label: 'SharePoint access granted', completed: true, timestamp: '2026-03-15 09:04', service: 'M365' },
  { id: 'p5', label: 'Apple ID created', completed: true, timestamp: '2026-03-15 09:05', service: 'Apple' },
];

export const mockEmployees: Employee[] = [
  {
    id: 'emp-001', firstName: 'Sophie', lastName: 'de Vries', email: 'sophie@cores.nl',
    personalEmail: 'sophie.devries@gmail.com', role: 'Sales Manager', department: 'Sales',
    startDate: '2025-01-15', contractType: 'Permanent', workPhone: '+31 6 1234 5678',
    personalPhone: '+31 6 8765 4321', status: 'Active', provisioningStatus: 'Provisioned',
    onboardingTasks: createOnboardingTasks('Sales').map(t => ({ ...t, completed: true, completedAt: t.completedAt || '2025-01-15 10:00' })),
    provisioningItems: createProvisioningItems('Sophie'),
  },
  {
    id: 'emp-002', firstName: 'Jan', lastName: 'Bakker', email: 'jan@cores.nl',
    personalEmail: 'jan.bakker@outlook.com', role: 'Customs Specialist', department: 'Customs & Compliance',
    startDate: '2025-03-01', contractType: 'Permanent', workPhone: '+31 6 2345 6789',
    personalPhone: '+31 6 9876 5432', status: 'Active', provisioningStatus: 'Provisioned',
    onboardingTasks: createOnboardingTasks('Customs & Compliance').map(t => ({ ...t, completed: true, completedAt: t.completedAt || '2025-03-01 10:00' })),
    provisioningItems: createProvisioningItems('Jan'),
  },
  {
    id: 'emp-003', firstName: 'Emma', lastName: 'Jansen', email: 'emma@cores.nl',
    personalEmail: 'emma.jansen@gmail.com', role: 'Transport Coordinator', department: 'Transport',
    startDate: '2025-06-10', contractType: 'Permanent', workPhone: '+31 6 3456 7890',
    personalPhone: '+31 6 0987 6543', status: 'Active', provisioningStatus: 'Provisioned',
    onboardingTasks: createOnboardingTasks('Transport').map(t => ({ ...t, completed: true, completedAt: t.completedAt || '2025-06-10 10:00' })),
    provisioningItems: createProvisioningItems('Emma'),
  },
  {
    id: 'emp-004', firstName: 'Daan', lastName: 'Visser', email: 'daan@cores.nl',
    personalEmail: 'daan.visser@gmail.com', role: 'Sales Representative', department: 'Sales',
    startDate: '2025-09-01', contractType: 'Permanent', workPhone: '+31 6 4567 8901',
    personalPhone: '+31 6 1098 7654', status: 'Active', provisioningStatus: 'Provisioned',
    onboardingTasks: createOnboardingTasks('Sales').map(t => ({ ...t, completed: true, completedAt: t.completedAt || '2025-09-01 10:00' })),
    provisioningItems: createProvisioningItems('Daan'),
  },
  {
    id: 'emp-005', firstName: 'Lisa', lastName: 'van den Berg', email: 'lisa@cores.nl',
    personalEmail: 'lisa.vdberg@outlook.com', role: 'Compliance Officer', department: 'Customs & Compliance',
    startDate: '2025-11-15', contractType: 'Permanent', workPhone: '+31 6 5678 9012',
    personalPhone: '+31 6 2109 8765', status: 'Active', provisioningStatus: 'Provisioned',
    onboardingTasks: createOnboardingTasks('Customs & Compliance').map(t => ({ ...t, completed: true, completedAt: t.completedAt || '2025-11-15 10:00' })),
    provisioningItems: createProvisioningItems('Lisa'),
  },
  {
    id: 'emp-006', firstName: 'Thomas', lastName: 'Mulder', email: 'thomas@cores.nl',
    personalEmail: 'thomas.mulder@gmail.com', role: 'Warehouse Manager', department: 'Transport',
    startDate: '2026-01-10', contractType: 'Permanent', workPhone: '+31 6 6789 0123',
    personalPhone: '+31 6 3210 9876', status: 'Active', provisioningStatus: 'Provisioned',
    onboardingTasks: createOnboardingTasks('Transport').map(t => ({ ...t, completed: true, completedAt: t.completedAt || '2026-01-10 10:00' })),
    provisioningItems: createProvisioningItems('Thomas'),
  },
  {
    id: 'emp-007', firstName: 'Fleur', lastName: 'Hendriks', email: 'fleur@cores.nl',
    personalEmail: 'fleur.hendriks@gmail.com', role: 'Sales Intern', department: 'Sales',
    startDate: '2026-03-01', contractType: 'Intern', workPhone: '+31 6 7890 1234',
    personalPhone: '+31 6 4321 0987', status: 'Onboarding', provisioningStatus: 'Provisioned',
    onboardingTasks: createOnboardingTasks('Sales'),
    provisioningItems: createProvisioningItems('Fleur'),
  },
  {
    id: 'emp-008', firstName: 'Niels', lastName: 'de Groot', email: 'niels@cores.nl',
    personalEmail: 'niels.degroot@outlook.com', role: 'Freight Forwarder', department: 'Transport',
    startDate: '2026-03-10', contractType: 'Permanent', workPhone: '+31 6 8901 2345',
    personalPhone: '+31 6 5432 1098', status: 'Onboarding', provisioningStatus: 'Pending',
    onboardingTasks: createOnboardingTasks('Transport').map((t, i) => ({ ...t, completed: i < 4 })),
    provisioningItems: createProvisioningItems('Niels').map((p, i) => ({ ...p, completed: i < 3 })),
  },
  {
    id: 'emp-009', firstName: 'Mila', lastName: 'Smit', email: 'mila@cores.nl',
    personalEmail: 'mila.smit@gmail.com', role: 'Customs Declarant', department: 'Customs & Compliance',
    startDate: '2026-03-18', contractType: 'Permanent', workPhone: '', personalPhone: '+31 6 6543 2109',
    status: 'Onboarding', provisioningStatus: 'Pending',
    onboardingTasks: createOnboardingTasks('Customs & Compliance').map((t, i) => ({ ...t, completed: i < 2 })),
    provisioningItems: createProvisioningItems('Mila').map((p, i) => ({ ...p, completed: i < 2 })),
  },
  {
    id: 'emp-010', firstName: 'Bram', lastName: 'Willems', email: '', personalEmail: 'bram.willems@gmail.com',
    role: 'Account Manager', department: 'Sales', startDate: '2024-05-01', contractType: 'Permanent',
    workPhone: '+31 6 9012 3456', personalPhone: '+31 6 7654 3210', status: 'Inactive',
    provisioningStatus: 'Provisioned',
    onboardingTasks: createOnboardingTasks('Sales').map(t => ({ ...t, completed: true, completedAt: '2024-05-01 10:00' })),
    provisioningItems: createProvisioningItems('Bram'),
  },
];

export const mockProvisioningJobs: ProvisioningJob[] = [
  {
    id: 'pj-001', employeeId: 'emp-009', employeeName: 'Mila Smit', service: 'M365',
    status: 'Running', triggeredAt: '2026-03-18 09:00',
    logs: [
      { step: 'Creating M365 account', timestamp: '2026-03-18 09:00:01', status: 'done' },
      { step: 'Assigning Business Premium licence', timestamp: '2026-03-18 09:00:15', status: 'done' },
      { step: 'Configuring email mila@cores.nl', timestamp: '2026-03-18 09:00:30', status: 'pending' },
      { step: 'Adding to shared mailboxes', timestamp: '', status: 'pending' },
      { step: 'Adding to SharePoint group', timestamp: '', status: 'pending' },
    ],
  },
  {
    id: 'pj-002', employeeId: 'emp-009', employeeName: 'Mila Smit', service: 'Apple ID',
    status: 'Queued', triggeredAt: '2026-03-18 09:00',
    logs: [
      { step: 'Creating Apple Business Manager account', timestamp: '', status: 'pending' },
    ],
  },
  {
    id: 'pj-003', employeeId: 'emp-008', employeeName: 'Niels de Groot', service: 'M365',
    status: 'Completed', triggeredAt: '2026-03-10 09:00', completedAt: '2026-03-10 09:05',
    logs: [
      { step: 'Creating M365 account', timestamp: '2026-03-10 09:00:01', status: 'done' },
      { step: 'Assigning Business Premium licence', timestamp: '2026-03-10 09:00:15', status: 'done' },
      { step: 'Configuring email niels@cores.nl', timestamp: '2026-03-10 09:00:30', status: 'done' },
      { step: 'Adding to shared mailboxes', timestamp: '2026-03-10 09:01:00', status: 'done' },
      { step: 'Adding to SharePoint group', timestamp: '2026-03-10 09:01:30', status: 'done' },
    ],
  },
  {
    id: 'pj-004', employeeId: 'emp-008', employeeName: 'Niels de Groot', service: 'Apple ID',
    status: 'Failed', triggeredAt: '2026-03-10 09:00',
    logs: [
      { step: 'Creating Apple Business Manager account', timestamp: '2026-03-10 09:02:00', status: 'error' },
    ],
  },
  {
    id: 'pj-005', employeeId: 'emp-007', employeeName: 'Fleur Hendriks', service: 'M365',
    status: 'Completed', triggeredAt: '2026-03-01 09:00', completedAt: '2026-03-01 09:04',
    logs: [
      { step: 'Creating M365 account', timestamp: '2026-03-01 09:00:01', status: 'done' },
      { step: 'Assigning Business Premium licence', timestamp: '2026-03-01 09:00:15', status: 'done' },
      { step: 'Configuring email fleur@cores.nl', timestamp: '2026-03-01 09:00:30', status: 'done' },
      { step: 'Adding to shared mailboxes', timestamp: '2026-03-01 09:01:00', status: 'done' },
      { step: 'Adding to SharePoint group', timestamp: '2026-03-01 09:01:30', status: 'done' },
    ],
  },
  {
    id: 'pj-006', employeeId: 'emp-007', employeeName: 'Fleur Hendriks', service: 'Apple ID',
    status: 'Completed', triggeredAt: '2026-03-01 09:00', completedAt: '2026-03-01 09:03',
    logs: [
      { step: 'Creating Apple Business Manager account', timestamp: '2026-03-01 09:02:00', status: 'done' },
    ],
  },
];

export const departments: Department[] = ['Sales', 'Customs & Compliance', 'Transport'];
export const contractTypes: ContractType[] = ['Permanent', 'Intern', 'Freelance'];

// === Leave Management Types & Data ===

export type LeaveType = 'Vacation' | 'Sick' | 'Parental';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface LeaveBalance {
  userId: string;
  totalAnnualDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  employeeName: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  substituteUserId?: string;
  status: LeaveStatus;
  createdAt: string;
  days: number;
}

export const mockLeaveBalances: LeaveBalance[] = [
  { userId: 'emp-001', totalAnnualDays: 25, usedDays: 8, pendingDays: 5, remainingDays: 12 },
  { userId: 'emp-002', totalAnnualDays: 25, usedDays: 5, pendingDays: 0, remainingDays: 20 },
  { userId: 'emp-003', totalAnnualDays: 25, usedDays: 12, pendingDays: 5, remainingDays: 8 },
  { userId: 'emp-004', totalAnnualDays: 25, usedDays: 3, pendingDays: 0, remainingDays: 22 },
  { userId: 'emp-005', totalAnnualDays: 25, usedDays: 7, pendingDays: 2, remainingDays: 16 },
  { userId: 'emp-006', totalAnnualDays: 25, usedDays: 10, pendingDays: 0, remainingDays: 15 },
  { userId: 'emp-007', totalAnnualDays: 15, usedDays: 0, pendingDays: 0, remainingDays: 15 },
  { userId: 'emp-008', totalAnnualDays: 25, usedDays: 0, pendingDays: 5, remainingDays: 20 },
  { userId: 'emp-009', totalAnnualDays: 25, usedDays: 0, pendingDays: 0, remainingDays: 25 },
  { userId: 'emp-010', totalAnnualDays: 25, usedDays: 20, pendingDays: 0, remainingDays: 5 },
];

export const mockLeaveRequests: LeaveRequest[] = [
  { id: 'lr-001', userId: 'emp-001', employeeName: 'Sophie de Vries', leaveType: 'Vacation', startDate: '2026-04-14', endDate: '2026-04-18', substituteUserId: 'emp-004', status: 'Pending', createdAt: '2026-03-20', days: 5 },
  { id: 'lr-002', userId: 'emp-003', employeeName: 'Emma Jansen', leaveType: 'Vacation', startDate: '2026-04-07', endDate: '2026-04-11', status: 'Pending', createdAt: '2026-03-18', days: 5 },
  { id: 'lr-003', userId: 'emp-005', employeeName: 'Lisa van den Berg', leaveType: 'Sick', startDate: '2026-03-24', endDate: '2026-03-25', status: 'Pending', createdAt: '2026-03-24', days: 2 },
  { id: 'lr-004', userId: 'emp-008', employeeName: 'Niels de Groot', leaveType: 'Vacation', startDate: '2026-05-05', endDate: '2026-05-09', substituteUserId: 'emp-006', status: 'Pending', createdAt: '2026-03-22', days: 5 },
  { id: 'lr-005', userId: 'emp-001', employeeName: 'Sophie de Vries', leaveType: 'Vacation', startDate: '2026-01-06', endDate: '2026-01-10', status: 'Approved', createdAt: '2025-12-15', days: 5 },
  { id: 'lr-006', userId: 'emp-001', employeeName: 'Sophie de Vries', leaveType: 'Sick', startDate: '2026-02-17', endDate: '2026-02-19', status: 'Approved', createdAt: '2026-02-17', days: 3 },
  { id: 'lr-007', userId: 'emp-002', employeeName: 'Jan Bakker', leaveType: 'Vacation', startDate: '2026-02-24', endDate: '2026-02-28', status: 'Approved', createdAt: '2026-02-01', days: 5 },
  { id: 'lr-008', userId: 'emp-003', employeeName: 'Emma Jansen', leaveType: 'Parental', startDate: '2026-01-13', endDate: '2026-01-24', status: 'Approved', createdAt: '2025-12-20', days: 10 },
  { id: 'lr-009', userId: 'emp-003', employeeName: 'Emma Jansen', leaveType: 'Sick', startDate: '2026-03-10', endDate: '2026-03-11', status: 'Approved', createdAt: '2026-03-10', days: 2 },
  { id: 'lr-010', userId: 'emp-006', employeeName: 'Thomas Mulder', leaveType: 'Vacation', startDate: '2026-03-03', endDate: '2026-03-14', status: 'Approved', createdAt: '2026-02-15', days: 10 },
  { id: 'lr-011', userId: 'emp-004', employeeName: 'Daan Visser', leaveType: 'Vacation', startDate: '2026-02-10', endDate: '2026-02-12', status: 'Approved', createdAt: '2026-01-20', days: 3 },
  { id: 'lr-012', userId: 'emp-005', employeeName: 'Lisa van den Berg', leaveType: 'Vacation', startDate: '2026-01-20', endDate: '2026-01-24', status: 'Approved', createdAt: '2026-01-05', days: 5 },
  { id: 'lr-013', userId: 'emp-005', employeeName: 'Lisa van den Berg', leaveType: 'Sick', startDate: '2026-03-03', endDate: '2026-03-04', status: 'Rejected', createdAt: '2026-03-03', days: 2 },
];

export const mockNotifications: AppNotification[] = [
  {
    id: 'ntf-001',
    createdAt: '2026-03-27T09:18:00.000Z',
    title: 'Leave request awaiting approval',
    description: 'Sophie de Vries submitted a vacation request for 5 days.',
    type: 'info',
    isRead: false,
    link: '/absence',
  },
  {
    id: 'ntf-002',
    createdAt: '2026-03-27T08:51:00.000Z',
    title: 'Provisioning completed',
    description: 'M365 provisioning for Fleur Hendriks finished successfully.',
    type: 'success',
    isRead: false,
    link: '/provisioning',
  },
  {
    id: 'ntf-003',
    createdAt: '2026-03-27T07:43:00.000Z',
    title: 'Apple ID job failed',
    description: 'Apple ID provisioning failed for Niels de Groot. Review job logs.',
    type: 'error',
    isRead: false,
    link: '/provisioning',
  },
  {
    id: 'ntf-004',
    createdAt: '2026-03-26T16:25:00.000Z',
    title: 'New onboarding started',
    description: 'Mila Smit joined onboarding and has pending setup steps.',
    type: 'info',
    isRead: true,
    link: '/onboarding',
  },
  {
    id: 'ntf-005',
    createdAt: '2026-03-26T11:05:00.000Z',
    title: 'Missing employee work phone',
    description: 'One employee profile is missing a work phone number.',
    type: 'warning',
    isRead: true,
    link: '/employees',
  },
];
