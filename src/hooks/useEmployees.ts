import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { mockEmployees, type Employee, type Department, type ContractType, type EmployeeStatus, type ProvisioningStatus } from '@/data/mockData';

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

  return (data as SupabaseEmployeeRow[]).map(mapRowToEmployee);
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
