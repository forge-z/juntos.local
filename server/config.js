import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = Number(process.env.APP_PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('APP_PORT must be a valid port');
  const sessionDays = Number(process.env.SESSION_DAYS || 30);
  if (!Number.isInteger(sessionDays) || sessionDays < 1 || sessionDays > 3650) {
    throw new Error('SESSION_DAYS must be an integer between 1 and 3650');
  }
  let origin;
  try {
    const parsedOrigin = new URL(process.env.APP_ORIGIN || 'http://localhost:3000');
    if (!['http:', 'https:'].includes(parsedOrigin.protocol)) throw new Error('unsupported protocol');
    origin = parsedOrigin.origin;
  } catch { throw new Error('APP_ORIGIN must be a valid HTTP(S) URL'); }
  const timezone = process.env.TZ || 'America/Sao_Paulo';
  try { new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(); }
  catch { throw new Error('TZ must be a valid IANA timezone'); }

  return {
    nodeEnv,
    port,
    // Falha segura: sem .env, o primeiro boot conhecido fica acessível só
    // localmente. O Compose define 0.0.0.0 explicitamente dentro do container.
    host: process.env.APP_HOST || '127.0.0.1',
    origin,
    timezone,
    trustProxy: process.env.TRUST_PROXY === 'true',
    sessionDays,
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    dataDir: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(__dirname, '../data'),
  };
}
