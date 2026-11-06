import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { SESSION_QUERY_KEY } from '../session/session-queries';
import { ApiError } from './api-client';

const UNAUTHORIZED_STATUS = 401;

export function createQueryClient({
  shouldRetry = true,
}: { shouldRetry?: boolean } = {}): QueryClient {
  const forgetSessionOnUnauthorized = (error: Error) => {
    if (error instanceof ApiError && error.status === UNAUTHORIZED_STATUS) {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
    }
  };
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: forgetSessionOnUnauthorized }),
    mutationCache: new MutationCache({ onError: forgetSessionOnUnauthorized }),
    defaultOptions: {
      queries: { retry: shouldRetry ? 1 : false },
      mutations: { retry: false },
    },
  });
  return queryClient;
}
