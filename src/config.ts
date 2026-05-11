import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');

export const DATA_DIR = join(ROOT, 'data');
export const CHARACTERS_DIR = join(ROOT, 'characters');
export const LOGS_DIR = join(DATA_DIR, 'logs');
export const STATE_DIR = join(DATA_DIR, 'state');

export const PID_FILE = join(DATA_DIR, 'donna.pid');
export const PAIRED_USER_FILE = join(DATA_DIR, 'paired-user.json');
export const ACTIVE_CHARACTER_FILE = join(DATA_DIR, 'active-character.json');
export const PAIRING_CODES_FILE = join(DATA_DIR, 'pairing-codes.json');
export const LOG_FILE = join(LOGS_DIR, 'donna.log');

export function env(key: string): string | undefined {
  return process.env[key];
}

export function requireEnv(key: string): string {
  const value = env(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
