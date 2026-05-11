import { join } from 'node:path';
import { CHARACTERS_DIR } from '../config.js';
import { readFileUtf8, writeFileUtf8, deleteFile } from '../utils/files.js';

function resolveSoulPath(character: string): string {
  return join(CHARACTERS_DIR, character, 'SOUL.md');
}

function resolveBootstrapPath(character: string): string {
  return join(CHARACTERS_DIR, character, 'BOOTSTRAP.md');
}

export async function readSoul(character: string): Promise<string | null> {
  return readFileUtf8(resolveSoulPath(character));
}

export async function readBootstrap(character: string): Promise<string | null> {
  return readFileUtf8(resolveBootstrapPath(character));
}

export async function patchSoul(character: string, oldText: string, newText: string): Promise<string> {
  const soulPath = resolveSoulPath(character);
  let content = (await readFileUtf8(soulPath)) ?? '';

  if (oldText === '') {
    content += newText;
  } else {
    const occurrences = content.split(oldText).length - 1;
    if (occurrences === 0) {
      throw new Error(`Could not find the exact text to replace in SOUL.md.`);
    }
    if (occurrences > 1) {
      throw new Error(`Found ${occurrences} occurrences of the text in SOUL.md; provide a more specific match.`);
    }
    content = content.replace(oldText, newText);
  }

  await writeFileUtf8(soulPath, content);

  // Auto-delete BOOTSTRAP.md on first patch
  const bootstrapPath = resolveBootstrapPath(character);
  await deleteFile(bootstrapPath);

  return content;
}
