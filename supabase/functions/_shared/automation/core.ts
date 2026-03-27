// @ts-expect-error Edge function runtime resolves npm specifiers.
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';
import { microsoftProvider } from '../providers/microsoft.ts';
import type {
  AutomationService,
  EmployeeRow,
  ProvisioningJobRow,
  ProvisioningProvider,
  ProvisioningStep,
  RetryResult,
  TriggerResult,
} from './types.ts';

declare const Deno: {
  env: {
    get: (name: string) => string | undefined;
  };
};

const PROVIDERS: Record<string, ProvisioningProvider> = {
  M365: microsoftProvider,
};

export const getProvider = (service: AutomationService): ProvisioningProvider => {
  const provider = PROVIDERS[service];
  if (!provider) {
    throw new Error(`Unsupported automation service: ${service}`);
  }
  return provider;
};

export const createAdminClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase environment variables are missing');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey);
};

const insertLogs = async (
  admin: ReturnType<typeof createClient>,
  jobId: string,
  logs: ProvisioningStep[],
): Promise<void> => {
  if (logs.length === 0) {
    return;
  }

  const payload = logs.map((log) => ({
    job_id: jobId,
    step: log.step,
    status: log.status,
    log_timestamp: log.timestamp,
  }));

  const { error } = await admin.from('provisioning_job_logs').insert(payload);
  if (error) {
    throw new Error(`Failed to write provisioning logs: ${error.message}`);
  }
};

export const findEmployeeById = async (
  admin: ReturnType<typeof createClient>,
  employeeId: string,
): Promise<EmployeeRow | null> => {
  const { data, error } = await admin
    .from('employees')
    .select('id, first_name, last_name, email, department, status')
    .eq('id', employeeId)
    .maybeSingle<EmployeeRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
};

const runJob = async (
  admin: ReturnType<typeof createClient>,
  args: {
    jobId: string;
    employee: EmployeeRow;
    service: AutomationService;
    retryCount?: number;
  },
): Promise<'Completed' | 'Failed'> => {
  const { jobId, employee, service, retryCount } = args;
  const provider = getProvider(service);
  const runningAt = new Date().toISOString();

  await insertLogs(admin, jobId, [{ step: 'Worker started processing job', status: 'done', timestamp: runningAt }]);

  const { error: runningError } = await admin
    .from('provisioning_jobs')
    .update({ status: 'Running' })
    .eq('id', jobId);

  if (runningError) {
    throw new Error(runningError.message);
  }

  try {
    const providerLogs = await provider.run(employee);
    await insertLogs(admin, jobId, providerLogs);

    const completedAt = new Date().toISOString();
    const { error: completeError } = await admin
      .from('provisioning_jobs')
      .update({ status: 'Completed', completed_at: completedAt, last_error: null })
      .eq('id', jobId);

    if (completeError) {
      throw new Error(completeError.message);
    }

    return 'Completed';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown provisioning error';
    const failureAt = new Date().toISOString();

    await insertLogs(admin, jobId, [{ step: `Provisioning failed: ${message}`, status: 'error', timestamp: failureAt }]);

    const updatePayload: Record<string, unknown> = {
      status: 'Failed',
      completed_at: null,
      last_error: message,
    };

    if (typeof retryCount === 'number') {
      updatePayload.retry_count = retryCount;
    }

    const { error: failedError } = await admin
      .from('provisioning_jobs')
      .update(updatePayload)
      .eq('id', jobId);

    if (failedError) {
      throw new Error(failedError.message);
    }

    return 'Failed';
  }
};

export const triggerProvisioningForEmployee = async (
  admin: ReturnType<typeof createClient>,
  args: {
    employee: EmployeeRow;
    service: AutomationService;
    source: 'manual-ui-trigger' | 'retry-endpoint';
  },
): Promise<TriggerResult> => {
  const { employee, service, source } = args;
  const idempotencyKey = `employee:${employee.id}:service:${service}:action:create`;

  const { data: existingJob, error: existingJobError } = await admin
    .from('provisioning_jobs')
    .select('id, status')
    .eq('idempotency_key', idempotencyKey)
    .neq('status', 'Failed')
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingJobError) {
    throw new Error(existingJobError.message);
  }

  if (existingJob) {
    return {
      status: existingJob.status,
      jobId: existingJob.id,
      reused: true,
    };
  }

  const provider = getProvider(service);
  const now = new Date().toISOString();
  const jobId = `pj-${crypto.randomUUID().slice(0, 8)}`;

  const { error: createJobError } = await admin.from('provisioning_jobs').insert({
    id: jobId,
    employee_id: employee.id,
    service,
    status: 'Queued',
    triggered_at: now,
    idempotency_key: idempotencyKey,
    metadata: {
      source,
      workflow: provider.workflowName,
    },
  });

  if (createJobError) {
    throw new Error(createJobError.message);
  }

  await insertLogs(admin, jobId, [
    { step: `Job queued by ${source}`, status: 'done', timestamp: now },
  ]);

  const status = await runJob(admin, {
    jobId,
    employee,
    service,
  });

  return {
    status,
    jobId,
    reused: false,
  };
};

export const retryProvisioningJob = async (
  admin: ReturnType<typeof createClient>,
  jobId: string,
): Promise<RetryResult> => {
  const { data: job, error: jobError } = await admin
    .from('provisioning_jobs')
    .select('id, employee_id, service, status, retry_count, idempotency_key')
    .eq('id', jobId)
    .maybeSingle<ProvisioningJobRow>();

  if (jobError) {
    throw new Error(jobError.message);
  }

  if (!job) {
    throw new Error('Provisioning job not found');
  }

  if (job.status !== 'Failed') {
    throw new Error('Only failed jobs can be retried');
  }

  const employee = await findEmployeeById(admin, job.employee_id);
  if (!employee) {
    throw new Error('Employee not found for provisioning job');
  }

  const retryCount = (job.retry_count ?? 0) + 1;
  const queuedAt = new Date().toISOString();

  const { error: requeueError } = await admin
    .from('provisioning_jobs')
    .update({
      status: 'Queued',
      triggered_at: queuedAt,
      completed_at: null,
      last_error: null,
      retry_count: retryCount,
    })
    .eq('id', jobId);

  if (requeueError) {
    throw new Error(requeueError.message);
  }

  await insertLogs(admin, jobId, [
    { step: 'Job requeued by retry endpoint', status: 'done', timestamp: queuedAt },
  ]);

  const status = await runJob(admin, {
    jobId,
    employee,
    service: job.service,
    retryCount,
  });

  return {
    status,
    jobId,
    retryCount,
  };
};
