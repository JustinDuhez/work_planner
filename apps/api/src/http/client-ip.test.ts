import Fastify from 'fastify';
import { registerClientIp } from './client-ip';

async function ipSeenBy(headerName: string | undefined, headers: Record<string, string>) {
  const app = Fastify();
  registerClientIp(app, headerName);
  app.get('/ip', (request) => ({ ip: request.clientIp }));
  const response = await app.inject({
    method: 'GET',
    url: '/ip',
    headers,
    remoteAddress: '10.25.1.2',
  });
  await app.close();
  return response.json<{ ip: string }>().ip;
}

describe('the client IP', () => {
  it('is the socket address when no client header is configured', async () => {
    expect(await ipSeenBy(undefined, { 'cf-connecting-ip': '203.0.113.7' })).toBe('10.25.1.2');
  });

  it('is the configured header when it holds one valid address', async () => {
    expect(await ipSeenBy('cf-connecting-ip', { 'cf-connecting-ip': '203.0.113.7' })).toBe(
      '203.0.113.7',
    );
    expect(await ipSeenBy('cf-connecting-ip', { 'cf-connecting-ip': '2001:db8::1' })).toBe(
      '2001:db8::1',
    );
  });

  it.each([
    ['missing', {}],
    ['not an address', { 'cf-connecting-ip': 'evil' }],
    ['a list', { 'cf-connecting-ip': '203.0.113.7, 198.51.100.1' }],
  ])('falls back to the socket address when the header is %s', async (_case, headers) => {
    expect(await ipSeenBy('cf-connecting-ip', headers)).toBe('10.25.1.2');
  });

  it('never believes X-Forwarded-For', async () => {
    expect(await ipSeenBy('cf-connecting-ip', { 'x-forwarded-for': '203.0.113.9' })).toBe(
      '10.25.1.2',
    );
  });
});
