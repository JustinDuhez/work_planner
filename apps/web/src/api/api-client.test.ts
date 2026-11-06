import { z } from 'zod';
import { ApiError, apiGet, apiSend, apiSendNoContent, setCsrfToken } from './api-client';
import { mockFetchRoutes } from '../test/mock-fetch';

const itemSchema = z.object({ name: z.string() });

function mockFetch(status: number, readBody: () => Promise<unknown>): void {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({ ok: status >= 200 && status < 300, status, json: readBody } as Response),
  );
}

describe('network failures', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('Failed to fetch')));
  });

  it('reads a failed GET as a French network error', async () => {
    await expect(apiGet('/api/v1/items/1', itemSchema)).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Connexion au serveur impossible. Vérifiez votre réseau et réessayez.',
    });
  });

  it('reads a failed write as a French network error', async () => {
    await expect(apiSendNoContent('DELETE', '/api/v1/items/1')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });
});

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

describe('apiSend', () => {
  afterEach(() => {
    setCsrfToken(undefined);
  });

  it('sends JSON with the CSRF token and parses the answer', async () => {
    const fetchMock = mockFetchRoutes({
      'PATCH /api/v1/items/1': { status: 200, body: { name: 'B' } },
    });
    setCsrfToken('csrf-123');

    await expect(apiSend('PATCH', '/api/v1/items/1', { name: 'B' }, itemSchema)).resolves.toEqual({
      name: 'B',
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init).toMatchObject({
      method: 'PATCH',
      credentials: 'same-origin',
      body: '{"name":"B"}',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-123' },
    });
  });

  it('accepts an answer without content', async () => {
    mockFetchRoutes({ 'DELETE /api/v1/sessions/current': { status: 204 } });

    await expect(apiSendNoContent('DELETE', '/api/v1/sessions/current')).resolves.toBeUndefined();
  });

  it('exposes the field messages of a validation error', async () => {
    mockFetchRoutes({
      'PATCH /api/v1/items/1': {
        status: 400,
        body: { code: 'VALIDATION_ERROR', message: 'Invalide', fieldErrors: { name: 'Requis.' } },
      },
    });

    await expect(apiSend('PATCH', '/api/v1/items/1', {}, itemSchema)).rejects.toMatchObject({
      status: 400,
      fieldErrors: { name: 'Requis.' },
    });
  });
});
