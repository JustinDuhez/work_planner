import type { FastifyInstance } from 'fastify';
import { DEFAULT_TEST_PASSWORD } from './fixtures';

/** Fastify's inject uses host "localhost:80", so this is the app's own origin in tests. */
export const TEST_ORIGIN = 'http://localhost:80';

export async function logIn(
  app: FastifyInstance,
  email: string,
  password: string = DEFAULT_TEST_PASSWORD,
): Promise<{ cookie: string; csrfToken: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/sessions',
    headers: { origin: TEST_ORIGIN },
    payload: { email, password },
  });
  const sessionCookie = response.cookies.find((cookie) => cookie.name === 'wp_session');
  if (response.statusCode !== 201 || !sessionCookie) {
    throw new Error(`Login failed for ${email}: ${response.statusCode} ${response.body}`);
  }
  return {
    cookie: `wp_session=${sessionCookie.value}`,
    csrfToken: response.json<{ csrfToken: string }>().csrfToken,
  };
}
