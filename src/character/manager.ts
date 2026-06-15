import { readdir, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { ACTIVE_CHARACTER_FILE, CHARACTERS_DIR } from '../config.js';
import { ensureDir, readJson, writeJson, writeFileUtf8, fileExists } from '../utils/files.js';

export async function getActiveCharacter(): Promise<string | null> {
  const data = await readJson<{ name: string }>(ACTIVE_CHARACTER_FILE);
  return data?.name ?? null;
}

export async function setActiveCharacter(name: string) {
  await writeJson(ACTIVE_CHARACTER_FILE, { name });
}

export async function clearActiveCharacter() {
  await writeJson(ACTIVE_CHARACTER_FILE, {});
}

export async function createCharacter(name: string): Promise<void> {
  const charDir = join(CHARACTERS_DIR, name);
  ensureDir(charDir);

  const soulPath = join(charDir, 'SOUL.md');
  const memoryPath = join(charDir, 'MEMORY.md');

  await writeFileUtf8(soulPath, '# SOUL\n\n');
  await writeFileUtf8(memoryPath, '# MEMORY\n\n');
}

export async function switchCharacter(name: string): Promise<boolean> {
  const charDir = join(CHARACTERS_DIR, name);
  if (!(await fileExists(join(charDir, 'SOUL.md')))) {
    return false;
  }
  await setActiveCharacter(name);
  return true;
}

export async function listCharacters(): Promise<string[]> {
  try {
    const entries = await readdir(CHARACTERS_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

const SAFE_NAME = /^[A-Za-z0-9_-]+$/;

export async function deleteCharacter(name: string): Promise<boolean> {
  if (!name || !SAFE_NAME.test(name)) {
    return false;
  }
  const charDir = resolve(join(CHARACTERS_DIR, name));
  if (!charDir.startsWith(resolve(CHARACTERS_DIR) + sep)) {
    return false;
  }
  if (!(await fileExists(join(charDir, 'SOUL.md')))) {
    return false;
  }
  await rm(charDir, { recursive: true, force: true });
  return true;
}
