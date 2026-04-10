import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { mockEmployees, type Employee, type Department, type ContractType, type EmployeeStatus, type ProvisioningStatus } from '@/data/mockData';
import { ONBOARDING_TASKS } from '@/data/onboardingTemplate';

interface SupabaseEmployeeRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  personal_email: string | null;
  role: string;
  department: string;
  start_date: string;
  contract_type: string;
  work_phone: string | null;
  personal_phone: string | null;
  status: string;
  provisioning_status: string;
  avatar: string | null;
}

interface SupabaseLegacyOnboardingTaskRow {
  id: string;
  employee_id: string;
  task_key: string;
  completed: boolean;
  automated: boolean;
  completed_at: string | null;
  department_specific: string | null;
}

interface SupabaseProvisioningItemRow {
  id: string;
  employee_id: string;
  label: string;
  completed: boolean;
  item_timestamp: string | null;
  service: 'M365' | 'Apple ID';
}

interface SupabaseWorkflowRow {
  id: string;
  employee_id: string;
}

interface SupabaseWorkflowTaskRow {
  workflow_id: string;
  task_template_id: string;
  status: 'pending' | 'in_progress' | 'waiting_external' | 'completed' | 'skipped';
  completed_at: string | null;
}

const taskTemplateMap = new Map(ONBOARDING_TASKS.map((task) => [task.id, task]));

const mapRowToEmployee = (row: SupabaseEmployeeRow): Employee => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  email: row.email || '',
  personalEmail: row.personal_email || '',
  role: row.role,
  department: row.department as Department,
  startDate: row.start_date,
  contractType: row.contract_type as ContractType,
  workPhone: row.work_phone || '',
  personalPhone: row.personal_phone || '',
  status: row.status as EmployeeStatus,
  provisioningStatus: row.provisioning_status as ProvisioningStatus,
  avatar: row.avatar || undefined,
  onboardingTasks: [],
  provisioningItems: [],
});

const EMPLOYEES_QUERY_KEY = ['employees'];

const fetchEmployees = async (): Promise<Employee[]> => {
  if (!isSupabaseConfigured || !supabase) {
    return mockEmployees;
  }

  const { data, error } = await supabase
    .from('employees')
    .select('id, first_name, last_name, email, personal_email, role, department, start_date, contract_type, work_phone, personal_phone, status, provisioning_status, avatar')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch employees from Supabase, falling back to mock data:', error.message);
    return mockEmployees;
  }

  const employees = (data as SupabaseEmployeeRow[]).map(mapRowToEmployee);
  const employeeIds = employees.map((employee) => employee.id);

  if (employeeIds.length === 0) {
    return employees;
  }

  const [legacyTasksResult, provisioningItemsResult, workflowsResult] = await Promise.all([
    supabase
      .from('onboarding_tasks')
      .select('id, employee_id, task_key, completed, automated, completed_at, department_specific')
      .in('employee_id', employeeIds),
    supabase
      .from('provisioning_items')
      .select('id, employee_id, label, completed, item_timestamp, service')
      .in('employee_id', employeeIds),
    supabase
      .from('onboarding_workflows')
      .select('id, employee_id')
      .in('employee_id', employeeIds),
  ]);

  const legacyTasksByEmployee = new Map<string, Employee['onboardingTasks']>();
  if (legacyTasksResult.error) {
    console.error('Failed to fetch legacy onboarding tasks:', legacyTasksResult.error.message);
  } else {
    ((legacyTasksResult.data || []) as SupabaseLegacyOnboardingTaskRow[]).forEach((task) => {
      const tasks = legacyTasksByEmployee.get(task.employee_id) || [];
      tasks.push({
        id: task.id,
        key: task.task_key,
        completed: task.completed,
        automated: task.automated,
        completedAt: task.completed_at || undefined,
        departmentSpecific: (task.department_specific || undefined) as Department | undefined,
      });
      legacyTasksByEmployee.set(task.employee_id, tasks);
    });
  }

  const provisioningItemsByEmployee = new Map<string, Employee['provisioningItems']>();
  if (provisioningItemsResult.error) {
    console.error('Failed to fetch provisioning items:', provisioningItemsResult.error.message);
  } else {
    ((provisioningItemsResult.data || []) as SupabaseProvisioningItemRow[]).forEach((item) => {
      const items = provisioningItemsByEmployee.get(item.employee_id) || [];
      items.push({
        id: item.id,
        label: item.label,
        completed: item.completed,
        timestamp: item.item_timestamp || undefined,
        service: item.service === 'Apple ID' ? 'Apple' : item.service,
      });
      provisioningItemsByEmployee.set(item.employee_id, items);
    });
  }

  const workflows = workflowsResult.error
    ? []
    : ((workflowsResult.data || []) as SupabaseWorkflowRow[]);

  if (workflowsResult.error) {
    console.error('Failed to fetch onboarding workflows:', workflowsResult.error.message);
  }

  const workflowTasksByEmployee = new Map<string, Employee['onboardingTasks']>();
  if (workflows.length > 0) {
    const workflowIds = workflows.map((workflow) => workflow.id);
    const workflowById = new Map(workflows.map((workflow) => [workflow.id, workflow.employee_id]));

    const { data: workflowTaskRows, error: workflowTaskError } = await supabase
      .from('onboarding_workflow_tasks')
      .select('workflow_id, task_template_id, status, completed_at')
      .in('workflow_id', workflowIds);

    if (workflowTaskError) {
      console.error('Failed to fetch onboarding workflow tasks:', workflowTaskError.message);
    } else {
      ((workflowTaskRows || []) as SupabaseWorkflowTaskRow[]).forEach((row) => {
        const employeeId = workflowById.get(row.workflow_id);
        if (!employeeId) {
          return;
        }

        const template = taskTemplateMap.get(row.task_template_id);
        const tasks = workflowTasksByEmployee.get(employeeId) || [];

        tasks.push({
          id: row.task_template_id,
          key: template?.title || row.task_template_id,
          completed: row.status === 'completed',
          automated: Boolean(template?.automatable),
          completedAt: row.completed_at || undefined,
        });

        workflowTasksByEmployee.set(employeeId, tasks);
      });
    }
  }

  return employees.map((employee) => ({
    ...employee,
    onboardingTasks:
      workflowTasksByEmployee.get(employee.id)
      || legacyTasksByEmployee.get(employee.id)
      || [],
    provisioningItems: provisioningItemsByEmployee.get(employee.id) || [],
  }));
};

export const useEmployees = () => {
  const query = useQuery({
    queryKey: EMPLOYEES_QUERY_KEY,
    queryFn: fetchEmployees,
    staleTime: 30_000,
  });

  return {
    employees: query.data ?? mockEmployees,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

export const useInvalidateEmployees = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: EMPLOYEES_QUERY_KEY });
};
