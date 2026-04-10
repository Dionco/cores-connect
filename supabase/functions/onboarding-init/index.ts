import { createAdminClient } from '../_shared/automation/core.ts';
import {
  deriveWorkflowStatus,
  getApplicableTaskTemplateIds,
  getInitialTaskStatus,
  type OnboardingTaskStatus,
  type ProvisioningBootstrapStatus,
} from '../_shared/onboarding/workflow.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InitializeRequest {
  employeeId?: string;
  provisioningStatus?: ProvisioningBootstrapStatus;
}

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const normalizeProvisioningStatus = (
  value: unknown,
): ProvisioningBootstrapStatus => {
  if (value === 'completed' || value === 'running' || value === 'failed') {
    return value;
  }

  return undefined;
};

const getAuthenticatedUserId = async (req: Request): Promise<string | null> => {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user.id;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return jsonResponse(401, { error: 'Authentication required' });
    }

    const payload = (await req.json()) as InitializeRequest;
    const employeeId = payload.employeeId?.trim();
    const provisioningStatus = normalizeProvisioningStatus(payload.provisioningStatus);

    if (!employeeId) {
      return jsonResponse(400, { error: 'employeeId is required' });
    }

    const admin = createAdminClient();

    const { data: employee, error: employeeError } = await admin
      .from('employees')
      .select('id, department')
      .eq('id', employeeId)
      .maybeSingle<{ id: string; department: string }>();

    if (employeeError) {
      return jsonResponse(500, { error: employeeError.message });
    }

    if (!employee) {
      return jsonResponse(404, { error: 'Employee not found' });
    }

    const { data: existingWorkflow, error: existingWorkflowError } = await admin
      .from('onboarding_workflows')
      .select('id, status')
      .eq('employee_id', employeeId)
      .maybeSingle<{ id: string; status: string }>();

    if (existingWorkflowError) {
      return jsonResponse(500, { error: existingWorkflowError.message });
    }

    if (existingWorkflow) {
      return jsonResponse(200, {
        workflowId: existingWorkflow.id,
        status: existingWorkflow.status,
        created: false,
      });
    }

    const taskTemplateIds = getApplicableTaskTemplateIds(employee.department);
    const now = new Date().toISOString();

    const taskRows = taskTemplateIds.map((taskTemplateId) => {
      const status = getInitialTaskStatus(taskTemplateId, provisioningStatus);
      const row: {
        task_template_id: string;
        status: OnboardingTaskStatus;
        completed_at?: string;
        completed_by?: string;
      } = {
        task_template_id: taskTemplateId,
        status,
      };

      if (status === 'completed') {
        row.completed_at = now;
        row.completed_by = 'system';
      }

      return row;
    });

    const workflowStatus = deriveWorkflowStatus(taskRows.map((task) => task.status));

    const { data: createdWorkflow, error: createWorkflowError } = await admin
      .from('onboarding_workflows')
      .insert({
        employee_id: employeeId,
        status: workflowStatus,
      })
      .select('id, status')
      .single<{ id: string; status: string }>();

    if (createWorkflowError) {
      if ((createWorkflowError as { code?: string }).code === '23505') {
        const { data: raceWorkflow } = await admin
          .from('onboarding_workflows')
          .select('id, status')
          .eq('employee_id', employeeId)
          .maybeSingle<{ id: string; status: string }>();

        if (raceWorkflow) {
          return jsonResponse(200, {
            workflowId: raceWorkflow.id,
            status: raceWorkflow.status,
            created: false,
          });
        }
      }

      return jsonResponse(500, { error: createWorkflowError.message });
    }

    const { error: createTasksError } = await admin
      .from('onboarding_workflow_tasks')
      .insert(
        taskRows.map((task) => ({
          workflow_id: createdWorkflow.id,
          task_template_id: task.task_template_id,
          status: task.status,
          completed_at: task.completed_at ?? null,
          completed_by: task.completed_by ?? null,
        })),
      );

    if (createTasksError) {
      await admin.from('onboarding_workflows').delete().eq('id', createdWorkflow.id);
      return jsonResponse(500, { error: createTasksError.message });
    }

    return jsonResponse(200, {
      workflowId: createdWorkflow.id,
      status: createdWorkflow.status,
      created: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse(500, { error: message });
  }
});
