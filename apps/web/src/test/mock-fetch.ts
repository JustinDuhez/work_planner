export interface MockResponse {
  status: number;
  body?: unknown;
}

/** Answers fetch calls from a 'METHOD /path' table; unknown routes fail loudly. */
export function mockFetchRoutes(routes: Record<string, MockResponse>): jest.Mock {
  const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const key = `${init?.method ?? 'GET'} ${url}`;
    const route = routes[key];
    if (!route) {
      return Promise.reject(new Error(`Unexpected request ${key}`));
    }
    return Promise.resolve({
      ok: route.status >= 200 && route.status < 300,
      status: route.status,
      json: () =>
        route.body === undefined
          ? Promise.reject(new SyntaxError('No body'))
          : Promise.resolve(route.body),
    } as Response);
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}
