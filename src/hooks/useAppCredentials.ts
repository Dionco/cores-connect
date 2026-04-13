import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteAppCredential,
  listAppCredentials,
  revealAppCredentialPassword,
  upsertAppCredential,
  type UpsertAppCredentialInput,
} from '@/lib/appCredentials';

const queryKey = (employeeId: string) => ['app-credentials', employeeId];

export const useAppCredentials = (employeeId: string) => {
  const qc = useQueryClient();
  const key = queryKey(employeeId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => listAppCredentials(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 15_000,
  });

  const upsert = useMutation({
    mutationFn: (input: UpsertAppCredentialInput) => upsertAppCredential(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAppCredential(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    credentials: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    upsert: upsert.mutateAsync,
    isSaving: upsert.isPending,
    remove: remove.mutateAsync,
    isRemoving: remove.isPending,
    reveal: (id: string) => revealAppCredentialPassword(id),
  };
};
