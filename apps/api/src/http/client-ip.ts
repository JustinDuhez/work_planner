import { isIP } from 'node:net';
import type { FastifyInstance, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    clientIp: string;
  }
}

/**
 * B1: behind Render + Cloudflare, `request.ip` is Render's internal hop. Cloudflare overwrites
 * the configured header on every request, so its single address is the visitor; anything else
 * (absent, malformed, a list) falls back to the socket address. X-Forwarded-For is never read here.
 */
export function clientIpOf(request: FastifyRequest, headerName: string | undefined): string {
  if (headerName === undefined) return request.ip;
  const value = request.headers[headerName];
  return typeof value === 'string' && isIP(value.trim()) !== 0 ? value.trim() : request.ip;
}

export function registerClientIp(app: FastifyInstance, headerName: string | undefined): void {
  app.decorateRequest('clientIp', '');
  app.addHook('onRequest', (request, _reply, done) => {
    request.clientIp = clientIpOf(request, headerName);
    done();
  });
}
