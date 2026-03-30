import {
  isSupabaseConfigured,
  supabase,
  supabaseFunctionBaseUrl,
  supabasePublishableClientKey,
} from '@/lib/supabase';
import type {
  CreateEmployeeInput,
  CreateEmployeeResult,
  GraphResourcesResult,
  RetryAutomationResult,
  TriggerAutomationInput,
  TriggerAutomationResult,
} from '@/lib/automation/types';

type EdgeFunctionErrorPayload = {
  error?: string;
  message?: string;
};

const getFreshAccessToken = async (): Promise<string> => {
  if (!supabase) {
    throw new Error('Supabase client is unavailable.');
  }

  const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    throw new Error(refreshError.message || 'Failed to refresh session. Please sign in again.');
  }

  const refreshedToken = refreshedData.session?.access_token;
  if (!refreshedToken) {
    throw new Error('You are not authenticated. Please sign in again and retry.');
  }

  return refreshedToken;
};

const getAccessTokenOrRefresh = async (): Promise<string> => {
  if (!supabase) {
    throw new Error('Supabase client is unavailable.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error(sessionError.message || 'Failed to read current session.');
  }

  const accessToken = sessionData.session?.access_token;
  if (accessToken) {
    return accessToken;
  }

  return getFreshAccessToken();
};

const invokeAuthenticatedFunction = async <TResult>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<TResult> => {
  const execute = async (accessToken: string): Promise<Response> => {
    return fetch(`${supabaseFunctionBaseUrl}/${functionName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabasePublishableClientKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  };

  let accessToken = await getAccessTokenOrRefresh();
  let response = await execute(accessToken);
  let payload = (await response.json().catch(() => null)) as (TResult & EdgeFunctionErrorPayload) | null;

  if (response.status === 401) {
    accessToken = await getFreshAccessToken();
    response = await execute(accessToken);
    payload = (await response.json().catch(() => null)) as (TResult & EdgeFunctionErrorPayload) | null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `${functionName} failed (HTTP ${response.status}).`);
  }

  return (payload || {}) as TResult;
};

export const createEmployeeRecord = async (
  input: CreateEmployeeInput,
): Promise<CreateEmployeeResult> => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured in this environment.');
  }

  const executeCreate = async (accessToken: string): Promise<Response> => {
    return fetch(`${supabaseFunctionBaseUrl}/employee-create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: supabasePublishableClientKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: input.firstName,
        lastName: input.lastName,
        workEmail: input.workEmail,
        personalEmail: input.personalEmail,
        role: input.role,
        department: input.department,
        startDate: input.startDate,
        contractType: input.contractType,
        workPhone: input.workPhone,
        personalPhone: input.personalPhone,
      }),
    });
  };

  let accessToken = await getAccessTokenOrRefresh();

  let response = await executeCreate(accessToken);
  let payload = (await response.json().catch(() => null)) as CreateEmployeeResult & { error?: string; message?: string } | null;

  const unauthorizedMessage = (payload?.error || payload?.message || '').toLowerCase();
  const shouldRetryWithRefresh = response.status === 401 && unauthorizedMessage.includes('invalid jwt');

  if (shouldRetryWithRefresh) {
    accessToken = await getFreshAccessToken();
    response = await executeCreate(accessToken);
    payload = (await response.json().catch(() => null)) as CreateEmployeeResult & { error?: string; message?: string } | null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(payload?.error || payload?.message || 'Unauthorized while calling employee-create. Please sign out and sign in again to refresh your Supabase session.');
    }

    throw new Error(payload?.error || payload?.message || `Failed to create employee record (HTTP ${response.status}).`);
  }

  const data = payload as CreateEmployeeResult | null;
  if (!data?.id) {
    throw new Error('Employee creation returned an invalid response.');
  }

  return {
    id: data.id,
    email: data.email || (input.workEmail || '').trim(),
  };
};

export const triggerOnboardingAutomation = async (
  input: TriggerAutomationInput,
): Promise<TriggerAutomationResult> => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured in this environment.');
  }

  const data = await invokeAuthenticatedFunction<TriggerAutomationResult>('onboarding-trigger', {
    employeeId: input.employeeId,
    service: input.service ?? 'M365',
    selectedMailboxes: input.selectedMailboxes,
    selectedGroupIds: input.selectedGroupIds,
  });

  if (!data?.jobId || !data?.status) {
    throw new Error('Onboarding automation returned an invalid response.');
  }

  return data;
};

export const fetchGraphResources = async (): Promise<GraphResourcesResult> => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured in this environment.');
  }

  const { data, error } = await supabase.functions.invoke<GraphResourcesResult>('graph-resources', {
    body: {},
  });

  if (error) {
    throw new Error(error.message || 'Failed to fetch Graph resources');
  }

  return {
    sharedMailboxes: data?.sharedMailboxes || [],
    securityGroups: data?.securityGroups || [],
  };
};

export const retryProvisioningAutomation = async (
  jobId: string,
): Promise<RetryAutomationResult> => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured in this environment.');
  }

  const data = await invokeAuthenticatedFunction<RetryAutomationResult>('provisioning-retry', {
    jobId,
  });

  if (!data?.jobId || !data?.status) {
    throw new Error('Provisioning retry returned an invalid response.');
  }

  return data;
};
