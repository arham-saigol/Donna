import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { startBot } from './discord/bot.js';
import { PID_FILE } from './config.js';
import { logger } from './logger.js';

function writePid() {
  try {
    writeFileSync(PID_FILE, String(process.pid), 'utf-8');
  } catch {
    // ignore
  }
}

function removePid() {
  try {
    if (existsSync(PID_FILE)) {
      unlinkSync(PID_FILE);
    }
  } catch {
    // ignore
  }
}

async function shutdown() {
  logger.info('Shutting down...');
  removePid();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception', err);
});

process.on('unhandledRejection', (err: unknown) => {
  logger.error('Unhandled rejection', err);
});

writePid();
logger.info(`Donna daemon started (PID ${process.pid})`);

startBot().catch((err) => {
  logger.error('Fatal bot error', err);
  removePid();
  process.exit(1);
});
