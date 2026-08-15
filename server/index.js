import { loadConfig } from './config.js';
import { initDb } from './db.js';
import { buildApp } from './app.js';

const config = loadConfig();
process.umask(0o077);
const db = await initDb(config);
const app = await buildApp(config, db);

async function shutdown(signal) {
  app.log.info(`recebido ${signal}, encerrando`);
  await app.close();
  db.close();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

await app.listen({ port: config.port, host: config.host });
