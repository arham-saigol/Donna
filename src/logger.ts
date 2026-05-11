import { mkdirSync } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, LOGS_DIR } from './config.js';

const logPath = join(LOGS_DIR, 'donna.log');
mkdirSync(LOGS_DIR, { recursive: true });

const stream = createWriteStream(logPath, { flags: 'a' });

function write(level: string, message: string, meta?: unknown) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    meta: meta ?? null,
  };
  stream.write(JSON.stringify(entry) + '\n');
}

export const logger = {
  debug: (msg: string, meta?: unknown) => write('debug', msg, meta),
  info: (msg: string, meta?: unknown) => write('info', msg, meta),
  warn: (msg: string, meta?: unknown) => write('warn', msg, meta),
  error: (msg: string, meta?: unknown) => write('error', msg, meta),
};
