import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

const SELF = "'self'";
const NONE = "'none'";

export async function registerSecurityHeaders(
  app: FastifyInstance,
  isProduction: boolean,
): Promise<void> {
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
