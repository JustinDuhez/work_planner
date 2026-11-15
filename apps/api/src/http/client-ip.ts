import { isIP } from 'node:net';
import type { FastifyInstance, FastifyRequest } from 'fastify';

const IPV4 = 4;

declare module 'fastify' {
  interface FastifyRequest {
    clientIp: string;
  }
}

/**
 * B1: behind Render + Cloudflare, `request.ip` is Render's internal hop. Cloudflare overwrites
 * the configured header on every request, so its single address is the visitor; anything else
 * (absent, malformed, a list) falls back to the socket address. X-Forwarded-For is never read here.
 * Only safe while every request reaches the app through Cloudflare: on an origin reachable
 * directly, a forged header would rotate the rate-limit key.
 */
export function clientIpOf(request: FastifyRequest, headerName: string | undefined): string {
  if (headerName === undefined) return request.ip;
  const value = request.headers[headerName];
  return typeof value === 'string' && isIP(value.trim()) !== 0 ? value.trim() : request.ip;
}

const IPV6_HEXTET_COUNT = 8;
const IPV6_PREFIX_HEXTET_COUNT = 4;
const IPV4_MAPPED_PREFIX_HEXTET = 0xffff;
const BYTE_RANGE = 256;

/** `::` expanded, an embedded IPv4 tail turned into its two hextets. */
function ipv6Hextets(address: string): number[] {
  let text = address.split('%')[0] ?? address;
  const embeddedIpv4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (embeddedIpv4) {
    const [, a, b, c, d] = embeddedIpv4.map(Number);
    text = `${text.slice(0, embeddedIpv4.index)}${((a ?? 0) * BYTE_RANGE + (b ?? 0)).toString(16)}:${((c ?? 0) * BYTE_RANGE + (d ?? 0)).toString(16)}`;
  }
  const [head = '', tail] = text.split('::');
  const headHextets = head === '' ? [] : head.split(':');
  const tailHextets = tail === undefined || tail === '' ? [] : tail.split(':');
  const zeroCount = IPV6_HEXTET_COUNT - headHextets.length - tailHextets.length;
  return [...headHextets, ...Array<string>(zeroCount).fill('0'), ...tailHextets].map((hextet) =>
    parseInt(hextet, 16),
  );
}

/**
 * The key the rate limits count by. One IPv6 subscriber owns a whole /64, so counting its single
 * addresses would give an attacker as many keys as they like; the /64 prefix is one visitor.
 */
export function rateLimitKeyOf(clientIp: string): string {
  if (isIP(clientIp) === IPV4) return clientIp;
  const hextets = ipv6Hextets(clientIp);
  const isIpv4Mapped =
    hextets.slice(0, 5).every((hextet) => hextet === 0) && hextets[5] === IPV4_MAPPED_PREFIX_HEXTET;
  if (isIpv4Mapped) {
    const [high = 0, low = 0] = hextets.slice(6);
    return [high >> 8, high % BYTE_RANGE, low >> 8, low % BYTE_RANGE].join('.');
  }
  return `${hextets
    .slice(0, IPV6_PREFIX_HEXTET_COUNT)
    .map((hextet) => hextet.toString(16))
    .join(':')}::/64`;
}

export function registerClientIp(app: FastifyInstance, headerName: string | undefined): void {
  app.decorateRequest('clientIp', '');
  app.addHook('onRequest', (request, _reply, done) => {
    request.clientIp = clientIpOf(request, headerName);
    done();
  });
}
