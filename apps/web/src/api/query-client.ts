import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { SESSION_QUERY_KEY } from '../session/session-queries';
import { ApiError } from './api-client';

const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;

export function createQueryClient({
  shouldRetry = true,
}: { shouldRetry?: boolean } = {}): QueryClient {
  const forgetSessionOnUnauthorized = (error: Error) => {
    if (error instanceof ApiError && error.status === UNAUTHORIZED_STATUS) {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
    }
    // Backstop: the session says whether a password change is due, so refetch it and let RequireAuth redirect.
    if (
      error instanceof ApiError &&
      error.status === FORBIDDEN_STATUS &&
      error.code === 'PASSWORD_CHANGE_REQUIRED'
    ) {
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
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
