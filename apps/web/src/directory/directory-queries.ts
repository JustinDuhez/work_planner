import { useQuery } from '@tanstack/react-query';
import { directorySchema } from '@work-planner/domain';
import { apiGet } from '../api/api-client';

export const DIRECTORY_QUERY_KEY = ['directory'] as const;

export function useDirectory(includeArchived: boolean) {
  return useQuery({
    queryKey: [...DIRECTORY_QUERY_KEY, includeArchived],
    queryFn: () =>
      apiGet(`/api/v1/users${includeArchived ? '?archived=true' : ''}`, directorySchema),
  });
}
