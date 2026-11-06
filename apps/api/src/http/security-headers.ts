import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

const SELF = "'self'";
const NONE = "'none'";

export async function registerSecurityHeaders(
  app: FastifyInstance,
  isProduction: boolean,
): Promise<void> {
  // API responses carry the CSRF token and personal data: no cache or proxy may keep them.
  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.header('cache-control', 'no-store');
    }
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [SELF],
        scriptSrc: [SELF],
        styleSrc: [SELF],
        imgSrc: [SELF, 'data:'],
        fontSrc: [SELF],
        connectSrc: [SELF],
        objectSrc: [NONE],
        baseUri: [SELF],
        formAction: [SELF],
        frameAncestors: [NONE],
        // Local development runs over plain HTTP; upgrading would break it.
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
  });
}
