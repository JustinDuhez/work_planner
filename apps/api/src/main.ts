import { buildApp } from './app';
import { loadConfig } from './config/config';
import { loadDotEnvIfPresent } from './config/load-env';
import { createDb } from './db/create-db';

loadDotEnvIfPresent();
const config = loadConfig(process.env);
const db = createDb(config.databaseUrl);
const app = await buildApp({ config, db });

app.addHook('onClose', async () => {
  await db.destroy();
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close();
  });
}

await app.listen({ host: config.host, port: config.port });
