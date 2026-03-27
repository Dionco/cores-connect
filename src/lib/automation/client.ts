import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type {
  RetryAutomationResult,
  TriggerAutomationInput,
  TriggerAutomationResult,
} from '@/lib/automation/types';

export const triggerOnboardingAutomation = async (
  input: TriggerAutomationInput,
): Promise<TriggerAutomationResult> => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured in this environment.');
  }

  const { data, error } = await supabase.functions.invoke<TriggerAutomationResult>('onboarding-trigger', {
    body: {
      employeeId: input.employeeId,
      service: input.service ?? 'M365',
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to trigger onboarding automation');
  }

  if (!data?.jobId || !data?.status) {
    throw new Error('Onboarding automation returned an invalid response.');
  }

  return data;
};

export const retryProvisioningAutomation = async (
  jobId: string,
): Promise<RetryAutomationResult> => {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured in this environment.');
  }

  const { data, error } = await supabase.functions.invoke<RetryAutomationResult>('provisioning-retry', {
    body: {
      jobId,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to retry provisioning automation');
  }

  if (!data?.jobId || !data?.status) {
    throw new Error('Provisioning retry returned an invalid response.');
  }

  return data;
};
