import { basename, join, resolve, sep } from 'node:path';
import { CHARACTERS_DIR } from '../config.js';
import { readFileUtf8, writeFileUtf8 } from '../utils/files.js';

function resolveSoulPath(character: string): string {
  if (character !== basename(character) || character.includes('..') || character.includes('/') || character.includes('\\')) {
    throw new Error(`Invalid character name: ${character}`);
  }
  const fullPath = resolve(join(CHARACTERS_DIR, character, 'SOUL.md'));
  if (!fullPath.startsWith(resolve(CHARACTERS_DIR) + sep)) {
    throw new Error(`Invalid soul path: ${character}`);
  }
  return fullPath;
}

export async function readSoul(character: string): Promise<string | null> {
  return readFileUtf8(resolveSoulPath(character));
}

export async function writeSoul(character: string, content: string): Promise<void> {
  await writeFileUtf8(resolveSoulPath(character), content);
}

export async function isSoulEmpty(character: string): Promise<boolean> {
  const content = await readSoul(character);
  return !content || content.trim() === '';
}
