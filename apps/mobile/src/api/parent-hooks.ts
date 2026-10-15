import { useQuery } from '@tanstack/react-query';

import { parentApi, queryKeys } from './parent';

/** The parent's family (Phase 1: exactly one, created at first login). */
export function useFamily() {
  const query = useQuery({ queryKey: queryKeys.families, queryFn: parentApi.families });
  return { ...query, family: query.data?.[0] };
}

export function useChildren(familyId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.children(familyId ?? ''),
    queryFn: () => parentApi.children(familyId!),
    enabled: !!familyId,
  });
}

export function usePendingRequests(pollMs: number | false = 15_000) {
  return useQuery({
    queryKey: queryKeys.pairingRequests,
    queryFn: parentApi.pendingPairingRequests,
    refetchInterval: pollMs,
  });
}

export function usePolicy(childId: string) {
  return useQuery({
    queryKey: queryKeys.policy(childId),
    queryFn: () => parentApi.policy(childId),
  });
}

export function useDevices(childId: string) {
  return useQuery({
    queryKey: queryKeys.devices(childId),
    queryFn: () => parentApi.devices(childId),
    refetchInterval: 30_000,
  });
}
