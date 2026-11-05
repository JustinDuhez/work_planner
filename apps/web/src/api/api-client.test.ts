import { z } from 'zod';
import { ApiError, apiGet } from './api-client';

const itemSchema = z.object({ name: z.string() });

function mockFetch(status: number, readBody: () => Promise<unknown>): void {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({ ok: status >= 200 && status < 300, status, json: readBody } as Response),
  );
}

describe('apiGet', () => {
  it('returns the body once it matches the expected contract', async () => {
    mockFetch(200, () => Promise.resolve({ name: 'Alice' }));

    await expect(apiGet('/api/v1/items/1', itemSchema)).resolves.toEqual({ name: 'Alice' });
  });

  it('turns an error answer into an ApiError carrying the server code and message', async () => {
    mockFetch(409, () =>
      Promise.resolve({ code: 'CLOCK_ALREADY_RUNNING', message: 'Déjà en cours' }),
    );

    await expect(apiGet('/api/v1/items/1', itemSchema)).rejects.toMatchObject({
      status: 409,
      code: 'CLOCK_ALREADY_RUNNING',
      message: 'Déjà en cours',
    });
  });

  it('falls back to a generic ApiError when the error body is not JSON', async () => {
    mockFetch(502, () => Promise.reject(new SyntaxError('Unexpected token <')));

    const request = apiGet('/api/v1/items/1', itemSchema);

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ status: 502, code: 'UNKNOWN_ERROR' });
  });

  it('rejects a successful answer that breaks the contract', async () => {
    mockFetch(200, () => Promise.resolve({ unexpected: true }));

    await expect(apiGet('/api/v1/items/1', itemSchema)).rejects.toThrow();
  });
});
