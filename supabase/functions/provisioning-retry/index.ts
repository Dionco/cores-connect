import { createAdminClient, MAX_RETRY_ATTEMPTS, retryProvisioningJob } from '../_shared/automation/core.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RetryRequest {
  jobId?: string;
}

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const toHttpError = (message: string): { status: number; code: string } => {
  if (message === 'Provisioning job not found') {
    return { status: 404, code: 'job_not_found' };
  }

  if (message === 'Only failed jobs can be retried') {
    return { status: 409, code: 'job_not_failed' };
  }

  if (message.startsWith('Retry limit reached')) {
    return { status: 409, code: 'retry_limit_reached' };
  }

  if (message === 'Employee not found for provisioning job') {
    return { status: 422, code: 'employee_not_found' };
  }

  return { status: 500, code: 'unexpected_error' };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const admin = createAdminClient();
    const payload = (await req.json()) as RetryRequest;

    if (!payload.jobId) {
      return jsonResponse(400, { error: 'jobId is required' });
    }

    const result = await retryProvisioningJob(admin, payload.jobId);

    return jsonResponse(200, {
      status: result.status,
      jobId: result.jobId,
      retryCount: result.retryCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    const mapped = toHttpError(message);
    return jsonResponse(mapped.status, {
      error: message,
      code: mapped.code,
      maxRetryAttempts: MAX_RETRY_ATTEMPTS,
    });
  }
});
