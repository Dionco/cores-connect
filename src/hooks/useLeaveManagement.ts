import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  mockLeaveBalances,
  mockLeaveRequests,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
} from '@/data/mockData';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const LEAVE_REQUESTS_QUERY_KEY = ['leave-requests'];
const LEAVE_BALANCES_QUERY_KEY = ['leave-balances'];

const MOCK_LEAVE_REQUESTS_STORAGE_KEY = 'cores:leave:requests';
const MOCK_LEAVE_BALANCES_STORAGE_KEY = 'cores:leave:balances';

type LeaveRequestRow = {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  substitute_user_id: string | null;
  status: LeaveStatus;
  created_at: string;
  days: number;
};

type LeaveBalanceRow = {
  user_id: string;
  total_annual_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
};

export interface SubmitLeaveRequestInput {
  userId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  substituteUserId?: string;
  days: number;
}

const sortRequestsByCreatedAt = (requests: LeaveRequest[]) => {
  return [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

const getStoredMockCollection = <T,>(key: string, fallback: T[]): T[] => {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as T[];
    if (!Array.isArray(parsed)) {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
};

const getStoredMockLeaveRequests = (): LeaveRequest[] => {
  return sortRequestsByCreatedAt(getStoredMockCollection(MOCK_LEAVE_REQUESTS_STORAGE_KEY, mockLeaveRequests));
};

const getStoredMockLeaveBalances = (): LeaveBalance[] => {
  return getStoredMockCollection(MOCK_LEAVE_BALANCES_STORAGE_KEY, mockLeaveBalances);
};

const setStoredMockLeaveRequests = (requests: LeaveRequest[]) => {
  localStorage.setItem(MOCK_LEAVE_REQUESTS_STORAGE_KEY, JSON.stringify(sortRequestsByCreatedAt(requests)));
};

const setStoredMockLeaveBalances = (balances: LeaveBalance[]) => {
  localStorage.setItem(MOCK_LEAVE_BALANCES_STORAGE_KEY, JSON.stringify(balances));
};

const fetchLeaveRequests = async (): Promise<LeaveRequest[]> => {
  if (!isSupabaseConfigured || !supabase) {
    return getStoredMockLeaveRequests();
  }

  const { data, error } = await supabase
    .from('leave_requests')
    .select('id, user_id, leave_type, start_date, end_date, substitute_user_id, status, created_at, days')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch leave requests from Supabase, falling back to mock data:', error.message);
    return getStoredMockLeaveRequests();
  }

  return ((data || []) as LeaveRequestRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    employeeName: row.user_id,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    substituteUserId: row.substitute_user_id || undefined,
    status: row.status,
    createdAt: row.created_at,
    days: row.days,
  }));
};

const fetchLeaveBalances = async (): Promise<LeaveBalance[]> => {
  if (!isSupabaseConfigured || !supabase) {
    return getStoredMockLeaveBalances();
  }

  const { data, error } = await supabase
    .from('leave_balances')
    .select('user_id, total_annual_days, used_days, pending_days, remaining_days');

  if (error) {
    console.error('Failed to fetch leave balances from Supabase, falling back to mock data:', error.message);
    return getStoredMockLeaveBalances();
  }

  return ((data || []) as LeaveBalanceRow[]).map((row) => ({
    userId: row.user_id,
    totalAnnualDays: row.total_annual_days,
    usedDays: row.used_days,
    pendingDays: row.pending_days,
    remainingDays: row.remaining_days,
  }));
};

const submitLeaveRequestMock = async (input: SubmitLeaveRequestInput) => {
  const leaveRequests = getStoredMockLeaveRequests();
  const balances = getStoredMockLeaveBalances();

  const currentBalance = balances.find((balance) => balance.userId === input.userId);
  if (!currentBalance) {
    throw new Error('Leave balance not found for user.');
  }

  if (currentBalance.remainingDays < input.days) {
    throw new Error('Insufficient remaining leave balance.');
  }

  const newRequest: LeaveRequest = {
    id: `lr-${Date.now()}`,
    userId: input.userId,
    employeeName: input.userId,
    leaveType: input.leaveType,
    startDate: input.startDate,
    endDate: input.endDate,
    substituteUserId: input.substituteUserId,
    status: 'Pending',
    createdAt: new Date().toISOString(),
    days: input.days,
  };

  const nextRequests = [newRequest, ...leaveRequests];
  const nextBalances = balances.map((balance) => {
    if (balance.userId !== input.userId) {
      return balance;
    }

    return {
      ...balance,
      pendingDays: balance.pendingDays + input.days,
      remainingDays: balance.remainingDays - input.days,
    };
  });

  setStoredMockLeaveRequests(nextRequests);
  setStoredMockLeaveBalances(nextBalances);
};

const approveLeaveRequestMock = async (requestId: string) => {
  const leaveRequests = getStoredMockLeaveRequests();
  const balances = getStoredMockLeaveBalances();

  const request = leaveRequests.find((item) => item.id === requestId);
  if (!request) {
    throw new Error('Leave request not found.');
  }

  if (request.status !== 'Pending') {
    throw new Error('Only pending leave requests can be approved.');
  }

  const nextRequests = leaveRequests.map((item) => {
    if (item.id !== requestId) {
      return item;
    }
    return { ...item, status: 'Approved' as LeaveStatus };
  });

  const nextBalances = balances.map((balance) => {
    if (balance.userId !== request.userId) {
      return balance;
    }

    const nextPending = balance.pendingDays - request.days;
    if (nextPending < 0) {
      throw new Error('Leave balance is inconsistent. Pending days cannot be negative.');
    }

    return {
      ...balance,
      pendingDays: nextPending,
      usedDays: balance.usedDays + request.days,
    };
  });

  setStoredMockLeaveRequests(nextRequests);
  setStoredMockLeaveBalances(nextBalances);
};

const rejectLeaveRequestMock = async (requestId: string) => {
  const leaveRequests = getStoredMockLeaveRequests();
  const balances = getStoredMockLeaveBalances();

  const request = leaveRequests.find((item) => item.id === requestId);
  if (!request) {
    throw new Error('Leave request not found.');
  }

  if (request.status !== 'Pending') {
    throw new Error('Only pending leave requests can be rejected.');
  }

  const nextRequests = leaveRequests.map((item) => {
    if (item.id !== requestId) {
      return item;
    }
    return { ...item, status: 'Rejected' as LeaveStatus };
  });

  const nextBalances = balances.map((balance) => {
    if (balance.userId !== request.userId) {
      return balance;
    }

    const nextPending = balance.pendingDays - request.days;
    if (nextPending < 0) {
      throw new Error('Leave balance is inconsistent. Pending days cannot be negative.');
    }

    return {
      ...balance,
      pendingDays: nextPending,
      remainingDays: balance.remainingDays + request.days,
    };
  });

  setStoredMockLeaveRequests(nextRequests);
  setStoredMockLeaveBalances(nextBalances);
};

const submitLeaveRequestRemote = async (input: SubmitLeaveRequestInput) => {
  if (!supabase) {
    throw new Error('Supabase client is unavailable.');
  }

  const { error } = await supabase.rpc('submit_leave_request', {
    p_user_id: input.userId,
    p_leave_type: input.leaveType,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_substitute_user_id: input.substituteUserId || null,
    p_days: input.days,
  });

  if (error) {
    throw new Error(error.message);
  }
};

const approveLeaveRequestRemote = async (requestId: string) => {
  if (!supabase) {
    throw new Error('Supabase client is unavailable.');
  }

  const { error } = await supabase.rpc('approve_leave_request', {
    p_request_id: requestId,
  });

  if (error) {
    throw new Error(error.message);
  }
};

const rejectLeaveRequestRemote = async (requestId: string) => {
  if (!supabase) {
    throw new Error('Supabase client is unavailable.');
  }

  const { error } = await supabase.rpc('reject_leave_request', {
    p_request_id: requestId,
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const useLeaveManagement = () => {
  const queryClient = useQueryClient();

  const leaveRequestsQuery = useQuery({
    queryKey: LEAVE_REQUESTS_QUERY_KEY,
    queryFn: fetchLeaveRequests,
    staleTime: 15_000,
  });

  const leaveBalancesQuery = useQuery({
    queryKey: LEAVE_BALANCES_QUERY_KEY,
    queryFn: fetchLeaveBalances,
    staleTime: 15_000,
  });

  const invalidateLeaveQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: LEAVE_REQUESTS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: LEAVE_BALANCES_QUERY_KEY }),
    ]);
  };

  const submitLeaveMutation = useMutation({
    mutationFn: async (input: SubmitLeaveRequestInput) => {
      if (!isSupabaseConfigured || !supabase) {
        await submitLeaveRequestMock(input);
        return;
      }

      await submitLeaveRequestRemote(input);
    },
    onSuccess: () => {
      void invalidateLeaveQueries();
    },
  });

  const approveLeaveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      if (!isSupabaseConfigured || !supabase) {
        await approveLeaveRequestMock(requestId);
        return;
      }

      await approveLeaveRequestRemote(requestId);
    },
    onSuccess: () => {
      void invalidateLeaveQueries();
    },
  });

  const rejectLeaveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      if (!isSupabaseConfigured || !supabase) {
        await rejectLeaveRequestMock(requestId);
        return;
      }

      await rejectLeaveRequestRemote(requestId);
    },
    onSuccess: () => {
      void invalidateLeaveQueries();
    },
  });

  return {
    leaveRequests: leaveRequestsQuery.data ?? mockLeaveRequests,
    balances: leaveBalancesQuery.data ?? mockLeaveBalances,
    isLoading: leaveRequestsQuery.isLoading || leaveBalancesQuery.isLoading,
    isMutating: submitLeaveMutation.isPending || approveLeaveMutation.isPending || rejectLeaveMutation.isPending,
    error:
      leaveRequestsQuery.error ||
      leaveBalancesQuery.error ||
      submitLeaveMutation.error ||
      approveLeaveMutation.error ||
      rejectLeaveMutation.error,
    submitLeaveRequest: submitLeaveMutation.mutateAsync,
    approveLeaveRequest: approveLeaveMutation.mutateAsync,
    rejectLeaveRequest: rejectLeaveMutation.mutateAsync,
    refetch: async () => {
      await Promise.all([leaveRequestsQuery.refetch(), leaveBalancesQuery.refetch()]);
    },
  };
};
