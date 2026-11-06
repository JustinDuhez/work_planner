import { ApiError } from './api-client';
import { createQueryClient } from './query-client';
import { SESSION_QUERY_KEY } from '../session/session-queries';

describe('createQueryClient', () => {
  it('forgets the session when any request answers 401', async () => {
    const queryClient = createQueryClient({ shouldRetry: false });
    queryClient.setQueryData(SESSION_QUERY_KEY, { user: { id: 1 }, csrfToken: 'x' });

    await queryClient
      .fetchQuery({
        queryKey: ['anything'],
        queryFn: () => Promise.reject(new ApiError(401, 'UNAUTHENTICATED', 'Expirée')),
      })
      .catch(() => undefined);

    expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull();
  });

  it('keeps the session for other errors', async () => {
    const queryClient = createQueryClient({ shouldRetry: false });
    const session = { user: { id: 1 }, csrfToken: 'x' };
    queryClient.setQueryData(SESSION_QUERY_KEY, session);

    await queryClient
      .fetchQuery({
        queryKey: ['anything'],
        queryFn: () => Promise.reject(new ApiError(500, 'INTERNAL_ERROR', 'Oups')),
      })
      .catch(() => undefined);

    expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toEqual(session);
  });
});
