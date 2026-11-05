import path from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance } from 'fastify';

const HASHED_ASSET_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const ALWAYS_REVALIDATE_CACHE_CONTROL = 'no-cache';

export async function registerSpa(app: FastifyInstance, webDistDirectory: string): Promise<void> {
  const hashedAssetsDirectory = path.join(webDistDirectory, 'assets');

  await app.register(fastifyStatic, {
    root: webDistDirectory,
    setHeaders: (reply, filePath) => {
      const isHashedAsset = filePath.startsWith(hashedAssetsDirectory);
      reply.header(
        'Cache-Control',
        isHashedAsset ? HASHED_ASSET_CACHE_CONTROL : ALWAYS_REVALIDATE_CACHE_CONTROL,
      );
    },
  });
}
