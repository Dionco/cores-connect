import { createAdminClient, retryProvisioningJob } from '../_shared/automation/core.ts';

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
    return jsonResponse(500, { error: message });
  }
});
