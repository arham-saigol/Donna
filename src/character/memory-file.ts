import { basename, join, resolve, sep } from 'node:path';
import { CHARACTERS_DIR } from '../config.js';
import { readFileUtf8, writeFileUtf8 } from '../utils/files.js';

function resolveMemoryPath(character: string): string {
  if (character !== basename(character) || character.includes('..') || character.includes('/') || character.includes('\\')) {
    throw new Error(`Invalid character name: ${character}`);
  }
  const fullPath = resolve(join(CHARACTERS_DIR, character, 'MEMORY.md'));
  if (!fullPath.startsWith(resolve(CHARACTERS_DIR) + sep)) {
    throw new Error(`Invalid memory path: ${character}`);
  }
  return fullPath;
}

export async function readMemory(character: string): Promise<string | null> {
  return readFileUtf8(resolveMemoryPath(character));
}

export async function writeMemory(character: string, content: string): Promise<void> {
  await writeFileUtf8(resolveMemoryPath(character), content);
}

export async function isMemoryEmpty(character: string): Promise<boolean> {
  const content = await readMemory(character);
  return !content || content.trim() === '';
}
