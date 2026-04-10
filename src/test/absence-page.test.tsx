import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/contexts/LanguageContext';
import AbsencePage from '@/pages/AbsencePage';
import type { Employee } from '@/data/mockData';

const {
  authState,
  leaveState,
  mockApproveLeaveRequest,
  mockRejectLeaveRequest,
  mockSubmitLeaveRequest,
  mockToast,
  mockCreateAppNotification,
} = vi.hoisted(() => ({
  authState: {
    user: { name: 'Sophie', email: 'sophie@cores.nl', role: 'hr_admin' },
    isAdmin: true,
  },
  leaveState: {
    leaveRequests: [
      {
        id: 'lr-pending',
        userId: 'emp-004',
        employeeName: 'Daan Visser',
        leaveType: 'Vacation',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        status: 'Pending',
        createdAt: '2026-03-20',
        days: 3,
      },
      {
        id: 'lr-my',
        userId: 'emp-001',
        employeeName: 'Sophie de Vries',
        leaveType: 'Sick',
        startDate: '2026-03-10',
        endDate: '2026-03-11',
        status: 'Approved',
        createdAt: '2026-03-10',
        days: 2,
      },
    ],
    balances: [
      {
        userId: 'emp-001',
        totalAnnualDays: 25,
        usedDays: 8,
        pendingDays: 3,
        remainingDays: 14,
      },
    ],
    isLoading: false,
    isMutating: false,
    error: null,
  },
  mockApproveLeaveRequest: vi.fn().mockResolvedValue(undefined),
  mockRejectLeaveRequest: vi.fn().mockResolvedValue(undefined),
  mockSubmitLeaveRequest: vi.fn().mockResolvedValue(undefined),
  mockToast: vi.fn(),
  mockCreateAppNotification: vi.fn().mockResolvedValue(undefined),
}));

const employees: Employee[] = [
  {
    id: 'emp-001',
    firstName: 'Sophie',
    lastName: 'de Vries',
    email: 'sophie@cores.nl',
    personalEmail: '',
    role: 'Sales Manager',
    department: 'Sales',
    startDate: '2025-01-01',
    contractType: 'Permanent',
    workPhone: '',
    personalPhone: '',
    status: 'Active',
    provisioningStatus: 'Provisioned',
    onboardingTasks: [],
    provisioningItems: [],
  },
  {
    id: 'emp-004',
    firstName: 'Daan',
    lastName: 'Visser',
    email: 'daan@cores.nl',
    personalEmail: '',
    role: 'Sales Representative',
    department: 'Sales',
    startDate: '2025-01-01',
    contractType: 'Permanent',
    workPhone: '',
    personalPhone: '',
    status: 'Active',
    provisioningStatus: 'Provisioned',
    onboardingTasks: [],
    provisioningItems: [],
  },
];

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('@/hooks/useEmployees', () => ({
  useEmployees: () => ({
    employees,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/useLeaveManagement', () => ({
  useLeaveManagement: () => ({
    ...leaveState,
    submitLeaveRequest: mockSubmitLeaveRequest,
    approveLeaveRequest: mockApproveLeaveRequest,
    rejectLeaveRequest: mockRejectLeaveRequest,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/lib/notifications', () => ({
  createAppNotification: mockCreateAppNotification,
}));

const renderPage = () =>
  render(
    <LanguageProvider>
      <AbsencePage />
    </LanguageProvider>,
  );

describe('AbsencePage', () => {
  beforeEach(() => {
    authState.user = { name: 'Sophie', email: 'sophie@cores.nl', role: 'hr_admin' };
    authState.isAdmin = true;
    mockApproveLeaveRequest.mockClear();
    mockRejectLeaveRequest.mockClear();
    mockSubmitLeaveRequest.mockClear();
    mockToast.mockClear();
    mockCreateAppNotification.mockClear();
  });

  it('hides approvals tab for non-admin users', () => {
    authState.user = { name: 'Sophie', email: 'sophie@cores.nl', role: 'employee' };
    authState.isAdmin = false;

    renderPage();

    expect(screen.queryByRole('tab', { name: /approvals/i })).not.toBeInTheDocument();
  });

  it('shows approvals tab for admins', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /approvals/i })).toBeInTheDocument();
    });
  });

  it('disables leave request button when account has no linked employee', () => {
    authState.user = { name: 'Unlinked', email: 'unknown@cores.nl', role: 'employee' };
    authState.isAdmin = false;

    renderPage();

    expect(screen.getByRole('button', { name: /request leave/i })).toBeDisabled();
    expect(screen.getByText('Your account is not linked to an employee record yet.')).toBeInTheDocument();
  });
});
