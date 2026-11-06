import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  sessionResponseSchema,
  type LoginRequest,
  type SessionResponse,
} from '@work-planner/domain';
import { ApiError, apiGet, apiSend, apiSendNoContent, setCsrfToken } from '../api/api-client';

export const SESSION_QUERY_KEY = ['session'] as const;
const UNAUTHORIZED_STATUS = 401;

async function fetchSession(): Promise<SessionResponse | null> {
  try {
    const session = await apiGet('/api/v1/me', sessionResponseSchema);
    setCsrfToken(session.csrfToken);
    return session;
  } catch (error) {
    if (error instanceof ApiError && error.status === UNAUTHORIZED_STATUS) {
      setCsrfToken(undefined);
      return null;
    }
    throw error;
  }
}

export function useSession() {
  return useQuery({ queryKey: SESSION_QUERY_KEY, queryFn: fetchSession, staleTime: Infinity });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginRequest) =>
      apiSend('POST', '/api/v1/sessions', credentials, sessionResponseSchema),
    onSuccess: (session) => {
      setCsrfToken(session.csrfToken);
      queryClient.setQueryData(SESSION_QUERY_KEY, session);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiSendNoContent('DELETE', '/api/v1/sessions/current'),
    onSettled: () => {
      setCsrfToken(undefined);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== SESSION_QUERY_KEY[0],
      });
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
    },
  });
}
