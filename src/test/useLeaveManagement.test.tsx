import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLeaveManagement } from '@/hooks/useLeaveManagement';

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useLeaveManagement', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('submits a leave request and updates balance in mock mode', async () => {
    const { result } = renderHook(() => useLeaveManagement(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialRequestCount = result.current.leaveRequests.length;
    const initialBalance = result.current.balances.find((item) => item.userId === 'emp-001');
    expect(initialBalance).toBeDefined();

    await act(async () => {
      await result.current.submitLeaveRequest({
        userId: 'emp-001',
        leaveType: 'Vacation',
        startDate: '2026-04-21',
        endDate: '2026-04-22',
        days: 2,
      });
    });

    await waitFor(() => {
      expect(result.current.leaveRequests.length).toBe(initialRequestCount + 1);
    });

    const updatedBalance = result.current.balances.find((item) => item.userId === 'emp-001');
    expect(updatedBalance?.pendingDays).toBe((initialBalance?.pendingDays || 0) + 2);
    expect(updatedBalance?.remainingDays).toBe((initialBalance?.remainingDays || 0) - 2);
  });

  it('approves a pending request and moves days from pending to used', async () => {
    const { result } = renderHook(() => useLeaveManagement(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const pendingRequest = result.current.leaveRequests.find((item) => item.id === 'lr-003');
    const initialBalance = result.current.balances.find((item) => item.userId === 'emp-005');

    expect(pendingRequest).toBeDefined();
    expect(initialBalance).toBeDefined();

    await act(async () => {
      await result.current.approveLeaveRequest('lr-003');
    });

    await waitFor(() => {
      const updatedRequest = result.current.leaveRequests.find((item) => item.id === 'lr-003');
      expect(updatedRequest?.status).toBe('Approved');
    });

    const updatedBalance = result.current.balances.find((item) => item.userId === 'emp-005');
    expect(updatedBalance?.pendingDays).toBe((initialBalance?.pendingDays || 0) - (pendingRequest?.days || 0));
    expect(updatedBalance?.usedDays).toBe((initialBalance?.usedDays || 0) + (pendingRequest?.days || 0));
  });

  it('rejects a pending request and restores remaining days', async () => {
    const { result } = renderHook(() => useLeaveManagement(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const pendingRequest = result.current.leaveRequests.find((item) => item.id === 'lr-002');
    const initialBalance = result.current.balances.find((item) => item.userId === 'emp-003');

    expect(pendingRequest).toBeDefined();
    expect(initialBalance).toBeDefined();

    await act(async () => {
      await result.current.rejectLeaveRequest('lr-002');
    });

    await waitFor(() => {
      const updatedRequest = result.current.leaveRequests.find((item) => item.id === 'lr-002');
      expect(updatedRequest?.status).toBe('Rejected');
    });

    const updatedBalance = result.current.balances.find((item) => item.userId === 'emp-003');
    expect(updatedBalance?.pendingDays).toBe((initialBalance?.pendingDays || 0) - (pendingRequest?.days || 0));
    expect(updatedBalance?.remainingDays).toBe((initialBalance?.remainingDays || 0) + (pendingRequest?.days || 0));
  });
});
