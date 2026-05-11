import { tool } from 'ai';
import { z } from 'zod';
import {
  getMemoryIndex,
  readMemory,
  writeMemory,
  deleteMemory,
} from '../character/memory.js';
import { patchSoul } from '../character/soul.js';

export function createTools(characterName: string) {
  return {
    get_memory: tool({
      description:
        'Read the INDEX.md for the current character to orient yourself at the start of each session. Returns a markdown string listing all memory files.',
      inputSchema: z.object({}),
      execute: async () => {
        const index = await getMemoryIndex(characterName);
        return index ?? 'No memory index found.';
      },
    }),

    read_memory: tool({
      description:
        'Read a specific memory file for the current character. Provide the file_path relative to the memory folder (e.g. people/john.md).',
      inputSchema: z.object({
        file_path: z.string().describe('Relative path to the memory file'),
      }),
      execute: async ({ file_path }) => {
        const content = await readMemory(characterName, file_path);
        return content ?? 'File not found.';
      },
    }),

    write_memory: tool({
      description:
        'Create or update a memory file for the current character. If the file exists it is updated; if not, it is created (title required for new files). The INDEX.md is updated automatically.',
      inputSchema: z.object({
        file_path: z.string().describe('Relative path inside the memory folder, e.g. people/john.md'),
        content: z.string().describe('Markdown content to write'),
        title: z.string().optional().describe('Title for the memory entry (required when creating a new file)'),
      }),
      execute: async ({ file_path, content, title }) => {
        await writeMemory(characterName, file_path, content, title);
        return `Memory saved to ${file_path}.`;
      },
    }),

    delete_memory: tool({
      description:
        'Delete a memory file for the current character. Provide the file_path relative to the memory folder. INDEX.md is updated automatically.',
      inputSchema: z.object({
        file_path: z.string().describe('Relative path to the memory file'),
      }),
      execute: async ({ file_path }) => {
        await deleteMemory(characterName, file_path);
        return `Deleted ${file_path}.`;
      },
    }),

    patch_soul: tool({
      description:
        'Evolve your own SOUL.md by performing a find-and-replace. Provide the exact old_text to find and the new_text to replace it with. If old_text is empty, new_text is appended. On the first call, BOOTSTRAP.md is auto-deleted.',
      inputSchema: z.object({
        old_text: z.string().describe('Exact string to find in SOUL.md (empty to append)'),
        new_text: z.string().describe('Replacement string'),
      }),
      execute: async ({ old_text, new_text }) => {
        const updated = await patchSoul(characterName, old_text, new_text);
        return `SOUL.md updated. Current length: ${updated.length} characters.`;
      },
    }),
  };
}
