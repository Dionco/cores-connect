import { createAdminClient } from '../_shared/automation/core.ts';
import {
  deriveWorkflowStatus,
  type OnboardingTaskStatus,
} from '../_shared/onboarding/workflow.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateTaskRequest {
  employeeId?: string;
  taskTemplateId?: string;
  status?: OnboardingTaskStatus;
  toggleCompleted?: boolean;
  note?: string;
}

const TASK_STATUSES = new Set<OnboardingTaskStatus>([
  'pending',
  'in_progress',
  'waiting_external',
  'completed',
  'skipped',
]);

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

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

    const payload = (await req.json()) as UpdateTaskRequest;
    const employeeId = payload.employeeId?.trim();
    const taskTemplateId = payload.taskTemplateId?.trim();

    if (!employeeId) {
      return jsonResponse(400, { error: 'employeeId is required' });
    }

    if (!taskTemplateId) {
      return jsonResponse(400, { error: 'taskTemplateId is required' });
    }

    if (payload.status && !TASK_STATUSES.has(payload.status)) {
      return jsonResponse(400, { error: 'Invalid task status' });
    }

    const admin = createAdminClient();

    const { data: workflow, error: workflowError } = await admin
      .from('onboarding_workflows')
      .select('id')
      .eq('employee_id', employeeId)
      .maybeSingle<{ id: string }>();

    if (workflowError) {
      return jsonResponse(500, { error: workflowError.message });
    }

    if (!workflow) {
      return jsonResponse(404, { error: 'Onboarding workflow not found' });
    }

    const { data: task, error: taskError } = await admin
      .from('onboarding_workflow_tasks')
      .select('id, status')
      .eq('workflow_id', workflow.id)
      .eq('task_template_id', taskTemplateId)
      .maybeSingle<{ id: string; status: OnboardingTaskStatus }>();

    if (taskError) {
      return jsonResponse(500, { error: taskError.message });
    }

    if (!task) {
      return jsonResponse(404, { error: 'Onboarding task not found in workflow' });
    }

    let nextStatus: OnboardingTaskStatus | undefined = payload.status;
    if (payload.toggleCompleted === true) {
      nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    }

    const noteProvided = typeof payload.note === 'string';

    if (!nextStatus && !noteProvided) {
      return jsonResponse(400, {
        error: 'Provide either status, toggleCompleted, or note',
      });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {};

    if (nextStatus) {
      updatePayload.status = nextStatus;

      if (nextStatus === 'completed') {
        updatePayload.completed_at = now;
        updatePayload.completed_by = userId;
      } else {
        updatePayload.completed_at = null;
        updatePayload.completed_by = null;
      }
    }

    if (noteProvided) {
      const trimmed = payload.note?.trim() || '';
      updatePayload.notes = trimmed || null;
    }

    const { data: updatedTask, error: updateTaskError } = await admin
      .from('onboarding_workflow_tasks')
      .update(updatePayload)
      .eq('id', task.id)
      .select('id, task_template_id, status, completed_at, completed_by, notes')
      .single();

    if (updateTaskError) {
      return jsonResponse(500, { error: updateTaskError.message });
    }

    const { data: workflowTasks, error: workflowTasksError } = await admin
      .from('onboarding_workflow_tasks')
      .select('status')
      .eq('workflow_id', workflow.id);

    if (workflowTasksError) {
      return jsonResponse(500, { error: workflowTasksError.message });
    }

    const statuses = (workflowTasks || []).map(
      (row) => row.status as OnboardingTaskStatus,
    );
    const workflowStatus = deriveWorkflowStatus(statuses);

    const { error: workflowUpdateError } = await admin
      .from('onboarding_workflows')
      .update({ status: workflowStatus })
      .eq('id', workflow.id);

    if (workflowUpdateError) {
      return jsonResponse(500, { error: workflowUpdateError.message });
    }

    return jsonResponse(200, {
      workflowId: workflow.id,
      workflowStatus,
      task: updatedTask,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse(500, { error: message });
  }
});
