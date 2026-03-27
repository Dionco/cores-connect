import { createAdminClient, findEmployeeById, triggerProvisioningForEmployee } from '../_shared/automation/core.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TriggerRequest {
  employeeId?: string;
  service?: 'M365' | 'Apple ID';
}

const PROVISIONING_SERVICE: TriggerRequest['service'] = 'M365';

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
    const payload = (await req.json()) as TriggerRequest;
    const employeeId = payload.employeeId;
    const service = payload.service ?? PROVISIONING_SERVICE;

    if (!employeeId) {
      return jsonResponse(400, { error: 'employeeId is required' });
    }

    if (service !== 'M365') {
      return jsonResponse(400, { error: 'Only M365 automation is implemented in v1' });
    }

    const employee = await findEmployeeById(admin, employeeId);

    if (!employee) {
      return jsonResponse(404, { error: 'Employee not found' });
    }
    const result = await triggerProvisioningForEmployee(admin, {
      employee,
      service,
      source: 'manual-ui-trigger',
    });

    return jsonResponse(200, {
      status: result.status,
      jobId: result.jobId,
      reused: result.reused,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse(500, { error: message });
  }
});
