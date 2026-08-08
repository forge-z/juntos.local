import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function initialPassword(name) {
  const value = process.env[name] || '';
  if (process.env.NODE_ENV === 'production' && (!value || value.length < 12 || /defina|troque|change|example/i.test(value))) {
    throw new Error(`${name} must be a real password with at least 12 characters`);
  }
  return value;
}

export function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = Number(process.env.APP_PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('APP_PORT must be a valid port');

  return {
    nodeEnv,
    port,
    host: process.env.APP_HOST || '0.0.0.0',
    origin: process.env.APP_ORIGIN || 'http://localhost:3000',
    timezone: process.env.TZ || 'America/Sao_Paulo',
    trustProxy: process.env.TRUST_PROXY === 'true',
    sessionDays: Number(process.env.SESSION_DAYS || 30),
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    dataDir: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(__dirname, '../data'),
    initialPasswords: { alexandre: initialPassword('ALEXANDRE_INITIAL_PASSWORD'), priscila: initialPassword('PRISCILA_INITIAL_PASSWORD') },
  };
}
