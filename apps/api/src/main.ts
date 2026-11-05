import path from 'node:path';
import { buildApp } from './app';
import { loadConfig } from './config/config';
import { loadDotEnvIfPresent } from './config/load-env';
import { createDb } from './db/create-db';

loadDotEnvIfPresent();
const config = loadConfig(process.env);
const db = createDb(config.databaseUrl);
// In production the API serves the built SPA; in development Vite serves it on port 5173.
const webDistDirectory = config.isProduction ? path.resolve('../web/dist') : undefined;
const app = await buildApp({ config, db, webDistDirectory });

app.addHook('onClose', async () => {
  await db.destroy();
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close();
  });
}

await app.listen({ host: config.host, port: config.port });
