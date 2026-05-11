import { mkdirSync } from 'node:fs';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Lock, Message, QueueEntry, StateAdapter } from 'chat';
import { STATE_DIR } from '../config.js';

function safeFileName(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function readJsonFile<T>(path: string): T | null {
  try {
    const data = readFileSync(path, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return null;
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
    if (existsSync(path)) {
      const existing = readJsonFile<{ expiresAt?: number }>(path);
      if (existing && (!existing.expiresAt || nowMs() <= existing.expiresAt)) {
        return false;
      }
    }
    await this.set(key, value, ttlMs);
    return true;
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
    let items = await this.getList<unknown>(key);
    items.push(value);
    if (options?.maxLength && items.length > options.maxLength) {
      items = items.slice(-options.maxLength);
    }
    const entry: { items: unknown[]; expiresAt?: number } = { items };
    if (options?.ttlMs && options.ttlMs > 0) {
      entry.expiresAt = nowMs() + options.ttlMs;
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
    const existing = readJsonFile<{ token: string; expiresAt: number }>(path);
    if (existing && nowMs() < existing.expiresAt) {
      return null;
    }
    const token = `${threadId}-${nowMs()}-${Math.random().toString(36).slice(2)}`;
    const lock: Lock = { threadId, token, expiresAt: nowMs() + ttlMs };
    writeJsonFile(path, { token, expiresAt: lock.expiresAt });
    return lock;
  }

  async extendLock(lock: Lock, ttlMs: number): Promise<boolean> {
    const path = resolvePath(`lock_${safeFileName(lock.threadId)}.json`);
    const existing = readJsonFile<{ token: string; expiresAt: number }>(path);
    if (!existing || existing.token !== lock.token) {
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
    const items = readJsonFile<QueueEntry[]>(path) ?? [];
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
    if (items.length === 0) return null;
    const entry = items.shift()!;
    writeJsonFile(path, items);
    if (entry.expiresAt && nowMs() > entry.expiresAt) {
      return this.dequeue(threadId);
    }
    return entry;
  }

  async queueDepth(threadId: string): Promise<number> {
    const path = resolvePath(`queue_${safeFileName(threadId)}.json`);
    const items = readJsonFile<QueueEntry[]>(path) ?? [];
    return items.length;
  }
}
