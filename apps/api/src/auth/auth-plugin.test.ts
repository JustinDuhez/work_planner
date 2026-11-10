import type { FastifyRequest } from 'fastify';
import { requireSession } from './auth-plugin';
import type { ResolvedSession } from './session-service';

describe('requireSession', () => {
  it('throws UNAUTHENTICATED when the request has no session', () => {
    expect(() => requireSession({ authSession: null } as FastifyRequest)).toThrow(
      expect.objectContaining({ code: 'UNAUTHENTICATED' }) as Error,
    );
  });

  it('returns the session of an authenticated request', () => {
    const session: ResolvedSession = {
      sessionId: 1,
      csrfToken: 'token',
      user: { id: 2, isAdmin: false, mustChangePassword: false },
    };

    expect(requireSession({ authSession: session } as FastifyRequest)).toBe(session);
  });
});
