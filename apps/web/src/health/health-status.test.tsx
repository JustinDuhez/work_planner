import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { copy } from '../copy';
import { HealthStatus } from './health-status';

function mockFetch(status: number, body: unknown): void {
  globalThis.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response),
  );
}

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('HealthStatus', () => {
  it('tells the user the service works when the API and database are up', async () => {
    mockFetch(200, { status: 'ok', database: 'up' });

    renderWithQueryClient(<HealthStatus />);

    expect(await screen.findByText(copy.health.operational)).toBeInTheDocument();
  });

  it('tells the user the service is unavailable when the API answers an error', async () => {
    mockFetch(503, { code: 'DATABASE_UNAVAILABLE', message: 'Base de données indisponible.' });

    renderWithQueryClient(<HealthStatus />);

    expect(await screen.findByText(copy.health.unavailable)).toBeInTheDocument();
  });

  it('shows a checking state while waiting for the answer', () => {
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => undefined));

    renderWithQueryClient(<HealthStatus />);

    expect(screen.getByRole('status')).toHaveTextContent(copy.health.checking);
  });
});
