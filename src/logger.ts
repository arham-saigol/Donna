import { mkdirSync } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { LOGS_DIR, LOG_FILE } from './config.js';

mkdirSync(LOGS_DIR, { recursive: true });

const stream = createWriteStream(LOG_FILE, { flags: 'a' });
stream.on('error', (err) => {
  console.error(`[logger] write stream error: ${err.message}`);
});

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
