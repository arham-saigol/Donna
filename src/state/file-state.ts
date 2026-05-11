import { mkdirSync } from 'node:fs';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { Lock, Message, QueueEntry, StateAdapter } from 'chat';
import { STATE_DIR } from '../config.js';

function safeFileName(id: string): string {
  return Buffer.from(id).toString('base64url');
}

function readJsonFile<T>(path: string): T | null {
  try {
    const data = readFileSync(path, 'utf-8');
    return JSON.parse(data) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

function writeJsonFile(path: string, data: unknown) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

function nowMs(): number {
  return Date.now();
}

function resolvePath(...parts: string[]): string {
  return join(STATE_DIR, ...parts);
}

/**
 * File-based state adapter. Designed for single-process use only;
 * concurrent access from multiple processes can cause lost writes on
 * read-modify-write operations (appendToList, subscribe, enqueue, etc.).
 */
export class FileStateAdapter implements StateAdapter {
  constructor() {
    mkdirSync(STATE_DIR, { recursive: true });
  }

  async connect(): Promise<void> {
    // No persistent connection needed
  }

  async disconnect(): Promise<void> {
    // No cleanup needed
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const path = resolvePath(`${safeFileName(key)}.json`);
    const entry = readJsonFile<{ value: T; expiresAt?: number }>(path);
    if (!entry) return null;
    if (entry.expiresAt && nowMs() > entry.expiresAt) {
      try { unlinkSync(path); } catch {}
      return null;
    }
    return entry.value;
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    const path = resolvePath(`${safeFileName(key)}.json`);
    const entry: { value: T; expiresAt?: number } = { value };
    if (ttlMs && ttlMs > 0) {
      entry.expiresAt = nowMs() + ttlMs;
    }
    writeJsonFile(path, entry);
  }

  async delete(key: string): Promise<void> {
    const path = resolvePath(`${safeFileName(key)}.json`);
    try { unlinkSync(path); } catch {}
  }

  async setIfNotExists(key: string, value: unknown, ttlMs?: number): Promise<boolean> {
    const path = resolvePath(`${safeFileName(key)}.json`);
    const entry: { value: unknown; expiresAt?: number } = { value };
    if (ttlMs && ttlMs > 0) entry.expiresAt = nowMs() + ttlMs;
    try {
      writeFileSync(path, JSON.stringify(entry, null, 2), { encoding: 'utf-8', flag: 'wx' });
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      const existing = readJsonFile<{ expiresAt?: number }>(path);
      if (!existing || (existing.expiresAt !== undefined && nowMs() > existing.expiresAt)) {
        writeJsonFile(path, entry);
        return true;
      }
      return false;
    }
  }

  async getList<T = unknown>(key: string): Promise<T[]> {
    const path = resolvePath(`list_${safeFileName(key)}.json`);
    const entry = readJsonFile<{ items: T[]; expiresAt?: number }>(path);
    if (!entry) return [];
    if (entry.expiresAt && nowMs() > entry.expiresAt) {
      try { unlinkSync(path); } catch {}
      return [];
    }
    return entry.items ?? [];
  }

  async appendToList(key: string, value: unknown, options?: { maxLength?: number; ttlMs?: number }): Promise<void> {
    const path = resolvePath(`list_${safeFileName(key)}.json`);
    const existing = readJsonFile<{ items: unknown[]; expiresAt?: number }>(path) ?? { items: [] };
    const now = nowMs();
    const items = (existing.expiresAt && now > existing.expiresAt) ? [] : (existing.items ?? []);
    items.push(value);
    const trimmed = (options?.maxLength && items.length > options.maxLength)
      ? items.slice(-options.maxLength)
      : items;
    const entry: { items: unknown[]; expiresAt?: number } = { items: trimmed };
    if (options?.ttlMs && options.ttlMs > 0) {
      entry.expiresAt = now + options.ttlMs;
    } else if (existing.expiresAt && now <= existing.expiresAt) {
      entry.expiresAt = existing.expiresAt;
    }
    writeJsonFile(path, entry);
  }

  async isSubscribed(threadId: string): Promise<boolean> {
    const subs = readJsonFile<string[]>(resolvePath('subscriptions.json')) ?? [];
    return subs.includes(threadId);
  }

  async subscribe(threadId: string): Promise<void> {
    const path = resolvePath('subscriptions.json');
    const subs = readJsonFile<string[]>(path) ?? [];
    if (!subs.includes(threadId)) {
      subs.push(threadId);
      writeJsonFile(path, subs);
    }
  }

  async unsubscribe(threadId: string): Promise<void> {
    const path = resolvePath('subscriptions.json');
    const subs = readJsonFile<string[]>(path) ?? [];
    const filtered = subs.filter((id) => id !== threadId);
    writeJsonFile(path, filtered);
  }

  async acquireLock(threadId: string, ttlMs: number): Promise<Lock | null> {
    const path = resolvePath(`lock_${safeFileName(threadId)}.json`);
    const token = `${threadId}-${nowMs()}-${Math.random().toString(36).slice(2)}`;
    const lock: Lock = { threadId, token, expiresAt: nowMs() + ttlMs };
    const entry = { token, expiresAt: lock.expiresAt };
    try {
      writeFileSync(path, JSON.stringify(entry, null, 2), { encoding: 'utf-8', flag: 'wx' });
      return lock;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      const existing = readJsonFile<{ token: string; expiresAt: number }>(path);
      if (existing && nowMs() < existing.expiresAt) {
        return null;
      }
      writeJsonFile(path, entry);
      return lock;
    }
  }

  async extendLock(lock: Lock, ttlMs: number): Promise<boolean> {
    const path = resolvePath(`lock_${safeFileName(lock.threadId)}.json`);
    const existing = readJsonFile<{ token: string; expiresAt: number }>(path);
    if (!existing || existing.token !== lock.token || existing.expiresAt <= nowMs()) {
      return false;
    }
    const newExpires = nowMs() + ttlMs;
    writeJsonFile(path, { token: lock.token, expiresAt: newExpires });
    return true;
  }

  async releaseLock(lock: Lock): Promise<void> {
    const path = resolvePath(`lock_${safeFileName(lock.threadId)}.json`);
    const existing = readJsonFile<{ token: string }>(path);
    if (existing && existing.token === lock.token) {
      try { unlinkSync(path); } catch {}
    }
  }

  async forceReleaseLock(threadId: string): Promise<void> {
    const path = resolvePath(`lock_${safeFileName(threadId)}.json`);
    try { unlinkSync(path); } catch {}
  }

  async enqueue(threadId: string, entry: QueueEntry, maxSize: number): Promise<number> {
    const path = resolvePath(`queue_${safeFileName(threadId)}.json`);
    const now = nowMs();
    const items = (readJsonFile<QueueEntry[]>(path) ?? []).filter(
      (item) => !item.expiresAt || now <= item.expiresAt
    );
    items.push(entry);
    if (items.length > maxSize) {
      items.shift();
    }
    writeJsonFile(path, items);
    return items.length;
  }

  async dequeue(threadId: string): Promise<QueueEntry | null> {
    const path = resolvePath(`queue_${safeFileName(threadId)}.json`);
    const items = readJsonFile<QueueEntry[]>(path) ?? [];
    let entry: QueueEntry | undefined;
    while (items.length > 0) {
      entry = items.shift()!;
      if (!entry.expiresAt || nowMs() <= entry.expiresAt) {
        writeJsonFile(path, items);
        return entry;
      }
    }
    writeJsonFile(path, items);
    return null;
  }

  async queueDepth(threadId: string): Promise<number> {
    const path = resolvePath(`queue_${safeFileName(threadId)}.json`);
    const now = nowMs();
    const items = (readJsonFile<QueueEntry[]>(path) ?? []).filter(
      (item) => !item.expiresAt || now <= item.expiresAt
    );
    return items.length;
  }
}
