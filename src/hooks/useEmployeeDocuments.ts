import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  deleteEmployeeDocument,
  listEmployeeDocuments,
  uploadEmployeeDocument,
  type EmployeeDocument,
  type UploadInput,
} from '@/lib/documents';
import { useEffect } from 'react';

const queryKey = (employeeId: string) => ['employee-documents', employeeId];

export const useEmployeeDocuments = (employeeId: string) => {
  const queryClient = useQueryClient();
  const key = queryKey(employeeId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => listEmployeeDocuments(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !employeeId) return;
    const channel = supabase
      .channel(`employee-documents-${employeeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'employee_documents', filter: `employee_id=eq.${employeeId}` },
        () => queryClient.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [employeeId, queryClient, key]);

  const uploadMutation = useMutation({
    mutationFn: (input: UploadInput) => uploadEmployeeDocument(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const deleteMutation = useMutation({
    mutationFn: (doc: EmployeeDocument) => deleteEmployeeDocument(doc),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return {
    documents: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    upload: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    remove: deleteMutation.mutateAsync,
    isRemoving: deleteMutation.isPending,
  };
};
