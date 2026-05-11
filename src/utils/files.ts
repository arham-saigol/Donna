import { mkdirSync } from 'node:fs';
import { access, readFile, writeFile, unlink, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readFileUtf8(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return null;
  }
}

export async function writeFileUtf8(path: string, content: string) {
  ensureDir(dirname(path));
  await writeFile(path, content, 'utf-8');
}

export async function deleteFile(path: string) {
  try {
    await unlink(path);
  } catch {
    // ignore
  }
}

export async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function readJson<T>(path: string): Promise<T | null> {
  const text = await readFileUtf8(path);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function writeJson(path: string, data: unknown) {
  ensureDir(dirname(path));
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

import { CHARACTERS_DIR } from '../config.js';

export function resolveCharacterDir(name: string): string {
  return join(CHARACTERS_DIR, name);
}
