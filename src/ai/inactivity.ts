import type { ModelMessage } from 'ai';
import { dream } from './dreamer.js';
import { logger } from '../logger.js';

export interface InactivityOptions<S> {
  thresholdMs?: number;
  pollIntervalMs?: number;
  getSessions: () => Map<string, S>;
}

const DEFAULT_THRESHOLD_MS = 30 * 60 * 1000;
const DEFAULT_POLL_MS = 60 * 1000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startInactivityWatcher<
  S extends { characterName: string; lastActivity: number; getMessages(): ModelMessage[] }
>(opts: InactivityOptions<S>) {
  if (intervalHandle) return;
  const threshold = opts.thresholdMs ?? DEFAULT_THRESHOLD_MS;
  const poll = opts.pollIntervalMs ?? DEFAULT_POLL_MS;

  const tick = () => {
    const now = Date.now();
    for (const session of opts.getSessions().values()) {
      if (now - session.lastActivity < threshold) continue;
      void dream(session.characterName, 'consolidate', session.getMessages());
    }
  };

  intervalHandle = setInterval(tick, poll);
  logger.info('Inactivity watcher started', { thresholdMs: threshold, pollIntervalMs: poll });
}

export function stopInactivityWatcher() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('Inactivity watcher stopped');
  }
}
