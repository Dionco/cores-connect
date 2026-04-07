import { createAdminClient } from '../_shared/automation/core.ts';

declare const Deno: {
  env: {
    get: (name: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateEmployeeRequest {
  firstName?: string;
  lastName?: string;
  workEmail?: string;
  personalEmail?: string;
  role?: string;
  department?: string;
  startDate?: string;
  contractType?: string;
  workPhone?: string;
  personalPhone?: string;
}

interface PostgresLikeError {
  code?: string;
  message?: string;
}

const VALID_DEPARTMENTS = new Set(['Sales', 'Customs & Compliance', 'Transport']);
const VALID_CONTRACT_TYPES = new Set(['Permanent', 'Intern', 'Freelance']);

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const parseBody = async (req: Request): Promise<CreateEmployeeRequest> => {
  try {
    return (await req.json()) as CreateEmployeeRequest;
  } catch {
    throw new Error('Invalid JSON payload');
  }
};

const requiredTrimmed = (value: string | undefined, field: string): string => {
  const trimmed = value?.trim() || '';
  if (!trimmed) {
    throw new Error(`${field} is required`);
  }
  return trimmed;
};

const optionalTrimmedOrNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim() || '';
  return trimmed ? trimmed : null;
};

const optionalNormalizedEmailOrNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim() || '';
  if (!trimmed) {
    return null;
  }

  return trimmed.toLowerCase();
};

const toConflictResponse = (
  error: PostgresLikeError,
  workEmail: string | null,
  personalEmail: string | null,
): Response => {
  const message = error.message || 'Unique constraint violation';

  if (message.includes('uq_employees_email_lower_not_blank')) {
    return jsonResponse(409, {
      code: 'DUPLICATE_WORK_EMAIL',
      field: 'workEmail',
      error: workEmail
        ? `Work email already exists: ${workEmail}. Please choose a different work email.`
        : 'Work email already exists. Please choose a different work email.',
    });
  }

  if (message.includes('uq_employees_personal_email_lower_not_blank')) {
    return jsonResponse(409, {
      code: 'DUPLICATE_PERSONAL_EMAIL',
      field: 'personalEmail',
      error: personalEmail
        ? `Personal email already exists: ${personalEmail}. Please choose a different personal email.`
        : 'Personal email already exists. Please choose a different personal email.',
    });
  }

  return jsonResponse(409, {
    code: 'UNIQUE_CONSTRAINT_VIOLATION',
    error: 'A record with one of the provided unique values already exists.',
  });
};

const validateStartDate = (value: string | undefined): string => {
  const trimmed = value?.trim() || '';
  if (!trimmed) {
    throw new Error('startDate is required');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('startDate must use yyyy-MM-dd format');
  }

  return trimmed;
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

    const payload = await parseBody(req);
    const firstName = requiredTrimmed(payload.firstName, 'firstName');
    const lastName = requiredTrimmed(payload.lastName, 'lastName');
    const role = requiredTrimmed(payload.role, 'role');
    const department = requiredTrimmed(payload.department, 'department');
    const startDate = validateStartDate(payload.startDate);
    const contractType = requiredTrimmed(payload.contractType, 'contractType');

    if (!VALID_DEPARTMENTS.has(department)) {
      return jsonResponse(400, { error: `Invalid department: ${department}` });
    }

    if (!VALID_CONTRACT_TYPES.has(contractType)) {
      return jsonResponse(400, { error: `Invalid contract type: ${contractType}` });
    }

    const employeeId = `emp-${crypto.randomUUID().slice(0, 8)}`;
    const email = optionalNormalizedEmailOrNull(payload.workEmail);
    const personalEmail = optionalNormalizedEmailOrNull(payload.personalEmail);

    const admin = createAdminClient();

    const { error } = await admin.from('employees').insert({
      id: employeeId,
      first_name: firstName,
      last_name: lastName,
      email,
      personal_email: personalEmail,
      role,
      department,
      start_date: startDate,
      contract_type: contractType,
      work_phone: optionalTrimmedOrNull(payload.workPhone),
      personal_phone: optionalTrimmedOrNull(payload.personalPhone),
      status: 'Onboarding',
      provisioning_status: 'Pending',
      avatar: null,
    });

    if (error) {
      const conflict = error.code === '23505';
      if (conflict) {
        return toConflictResponse(error, email, personalEmail);
      }

      return jsonResponse(500, { error: error.message });
    }

    return jsonResponse(200, {
      id: employeeId,
      email: email || '',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse(400, { error: message });
  }
});
