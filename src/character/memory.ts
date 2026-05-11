import { join, dirname, sep } from 'node:path';
import { CHARACTERS_DIR } from '../config.js';
import { readFileUtf8, writeFileUtf8, deleteFile, fileExists, ensureDir } from '../utils/files.js';

function resolveMemoryPath(character: string, filePath: string): string {
  const basePath = join(CHARACTERS_DIR, character, 'memory');
  const fullPath = join(basePath, filePath);
  if (!fullPath.startsWith(basePath + sep)) {
    throw new Error(`Invalid memory path: ${filePath}`);
  }
  return fullPath;
}

function resolveIndexPath(character: string): string {
  return join(CHARACTERS_DIR, character, 'memory', 'INDEX.md');
}

function escapeMarkdownLink(text: string): string {
  return text.replace(/\]/g, '\\]');
}

export async function getMemoryIndex(character: string): Promise<string | null> {
  return readFileUtf8(resolveIndexPath(character));
}

export async function readMemory(character: string, filePath: string): Promise<string | null> {
  return readFileUtf8(resolveMemoryPath(character, filePath));
}

export async function writeMemory(
  character: string,
  filePath: string,
  content: string,
  title?: string
): Promise<void> {
  const fullPath = resolveMemoryPath(character, filePath);
  const exists = await fileExists(fullPath);

  if (!exists && !title) {
    throw new Error('Title is required when creating a new memory file.');
  }

  ensureDir(dirname(fullPath));

  await writeFileUtf8(fullPath, content);

  // Update INDEX.md
  const indexPath = resolveIndexPath(character);
  let index = (await readFileUtf8(indexPath)) ?? '# Memory Index\n\n## Files\n\n';

  const linkLine = `- [${escapeMarkdownLink(title ?? filePath)}](${filePath})`;
  const fileLinkPattern = new RegExp(`- \\[[^\\]]*\\]\\(${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`);

  if (fileLinkPattern.test(index)) {
    // Update existing entry title if provided
    if (title) {
      index = index.replace(fileLinkPattern, linkLine);
    }
  } else {
    index += `${linkLine}\n`;
  }

  await writeFileUtf8(indexPath, index);
}

export async function deleteMemory(character: string, filePath: string): Promise<void> {
  const fullPath = resolveMemoryPath(character, filePath);
  await deleteFile(fullPath);

  // Update INDEX.md
  const indexPath = resolveIndexPath(character);
  let index = await readFileUtf8(indexPath);
  if (!index) return;

  const fileLinkPattern = new RegExp(`- \\[[^\\]]*\\]\\(${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\n?`);
  index = index.replace(fileLinkPattern, '');
  await writeFileUtf8(indexPath, index);
}
