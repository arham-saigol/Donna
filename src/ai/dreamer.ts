import { generateText, type JSONValue, type LanguageModel, type ModelMessage } from 'ai';
import { getFallbackModel, getProModel } from './models.js';
import { parseDreamerResponse } from './dreamer-parser.js';
import { readSoul, isSoulEmpty, writeSoul } from '../character/soul.js';
import { readMemory, writeMemory, isMemoryEmpty } from '../character/memory-file.js';
import { logger } from '../logger.js';

export { parseDreamerResponse } from './dreamer-parser.js';

export type DreamMode = 'consolidate' | 'refresh';

const DREAMER_SYSTEM_PROMPT = `You are the Dreamer for a character. You maintain two files:

- SOUL.md: who the character is. Identity, personality, voice, behavior rules.
- MEMORY.md: what the character knows. People, facts, events, preferences,
  ongoing state.

You receive:
- The current contents of SOUL.md and MEMORY.md (may be empty).
- A transcript of the most recent session (may be "no new transcript; refresh pass").

Produce updated versions of both files. You may reorganize, drop outdated
info, add new info from the transcript, or leave them unchanged. Be
conservative — do not invent facts that are not supported by the transcript.
For a refresh pass with no transcript, you may keep the files as-is or
refactor for clarity.

SOUL.md is identity; do not put transient facts there.
MEMORY.md is knowledge; do not put identity/personality there.

Return your response in exactly this format. No prose outside these blocks:

<!-- SOUL.md -->
<full new contents of SOUL.md>

<!-- MEMORY.md -->
<full new contents of MEMORY.md>
`;

const inFlightDreams = new Map<string, Promise<void>>();
const pendingDreams = new Map<string, Array<{ mode: DreamMode; transcript?: ModelMessage[] }>>();

function withDeepSeekFallbackHint(error: unknown): Error {
  const hint = 'Set DEEPSEEK_API_KEY to enable the fallback.';
  if (error instanceof Error) {
    if (!error.message.includes(hint)) {
      error.message = `${error.message} ${hint}`;
    }
    return error;
  }
  return new Error(`${String(error)} ${hint}`);
}

async function generateWithFallback(
  primaryModel: LanguageModel | null,
  options: Omit<Parameters<typeof generateText>[0], 'model'>
): Promise<Awaited<ReturnType<typeof generateText>>> {
  if (!primaryModel) {
    const fallbackModel = getFallbackModel('Deepseek V4 Pro');
    if (!fallbackModel) {
      throw new Error(
        'Missing required environment variable: AI_GATEWAY_API_KEY. Set DEEPSEEK_API_KEY to enable the fallback.'
      );
    }
    return await generateText({ ...options, model: fallbackModel } as Parameters<typeof generateText>[0]);
  }

  try {
    return await generateText({ ...options, model: primaryModel } as Parameters<typeof generateText>[0]);
  } catch (error) {
    const fallbackModel = getFallbackModel('Deepseek V4 Pro');
    if (!fallbackModel) {
      throw withDeepSeekFallbackHint(error);
    }
    logger.warn('Dreamer primary model failed; retrying with DeepSeek fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
    return await generateText({ ...options, model: fallbackModel } as Parameters<typeof generateText>[0]);
  }
}

function formatTranscript(messages: ModelMessage[]): string {
  return messages
    .map((msg) => {
      if (msg.role === 'user') {
        return `USER: ${typeof msg.content === 'string' ? msg.content : extractText(msg.content)}`;
      }
      if (msg.role === 'assistant') {
        return `ASSISTANT: ${typeof msg.content === 'string' ? msg.content : extractText(msg.content)}`;
      }
      if (msg.role === 'system') {
        return `SYSTEM: ${typeof msg.content === 'string' ? msg.content : extractText(msg.content)}`;
      }
      // tool role
      const toolContent = Array.isArray(msg.content)
        ? msg.content.map((c: { type: string; output?: unknown; result?: unknown }) => {
            if (c.type === 'tool-result') {
              return typeof c.output === 'string' ? c.output : JSON.stringify(c.output ?? c.result);
            }
            return '';
          }).join('\n')
        : typeof msg.content === 'string'
          ? msg.content
          : JSON.stringify(msg.content);
      return `TOOL_RESULT: ${toolContent}`;
    })
    .join('\n\n');
}

function extractText(content: unknown): string {
  if (Array.isArray(content)) {
    return content
      .map((part: { type?: string; text?: string }) => (part.type === 'text' ? part.text ?? '' : ''))
      .join('\n');
  }
  return JSON.stringify(content);
}

async function runDream(character: string, mode: DreamMode, transcript: ModelMessage[] | undefined) {
  try {
    const soulEmpty = await isSoulEmpty(character);
    const memoryEmpty = await isMemoryEmpty(character);

    if (mode === 'refresh' && soulEmpty && memoryEmpty) {
      logger.info('Dream skipped: both SOUL and MEMORY empty', { character, mode });
      return;
    }
    if (mode === 'consolidate' && (!transcript || transcript.length === 0)) {
      logger.info('Dream skipped: empty transcript', { character, mode });
      return;
    }

    const currentSoul = (await readSoul(character)) ?? '';
    const currentMemory = (await readMemory(character)) ?? '';

    const transcriptSection =
      mode === 'consolidate' && transcript && transcript.length > 0
        ? formatTranscript(transcript)
        : 'no new transcript; refresh pass';

    const userMessage = [
      '--- CURRENT SOUL.md ---',
      currentSoul || '(empty)',
      '',
      '--- CURRENT MEMORY.md ---',
      currentMemory || '(empty)',
      '',
      '--- TRANSCRIPT ---',
      transcriptSection,
    ].join('\n');

    let response: Awaited<ReturnType<typeof generateText>>;
    try {
      response = await generateWithFallback(getProModel(), {
        system: DREAMER_SYSTEM_PROMPT,
        prompt: userMessage,
        providerOptions: {
          deepseek: { thinking: { type: 'enabled' }, reasoningEffort: 'max' },
        } as Record<string, Record<string, JSONValue>>,
      });
    } catch (err) {
      logger.error('Dreamer generateText failed', { character, mode, err });
      return;
    }

    const parsed = parseDreamerResponse(response.text);
    if (!parsed) {
      logger.error('Dreamer response parse failed; files left unchanged', { character, mode });
      return;
    }

    await writeSoul(character, parsed.soul);
    await writeMemory(character, parsed.memory);

    logger.info('Dream completed', { character, mode, soulLen: parsed.soul.length, memoryLen: parsed.memory.length });
  } catch (err) {
    logger.error('Dreamer run failed', { character, mode, err });
  }
}

function startDream(character: string, mode: DreamMode, transcript?: ModelMessage[]): Promise<void> {
  const promise = runDream(character, mode, transcript).finally(() => {
    if (inFlightDreams.get(character) === promise) {
      inFlightDreams.delete(character);
    }
    const queue = pendingDreams.get(character);
    if (queue && queue.length > 0) {
      const next = queue.shift()!;
      if (queue.length === 0) {
        pendingDreams.delete(character);
      }
      startDream(character, next.mode, next.transcript);
    }
  });
  inFlightDreams.set(character, promise);
  return promise;
}

export async function dream(
  character: string,
  mode: DreamMode,
  transcript?: ModelMessage[]
): Promise<void> {
  if (inFlightDreams.has(character)) {
    const queue = pendingDreams.get(character) ?? [];
    if (mode === 'consolidate') {
      const last = queue[queue.length - 1];
      if (last?.mode === 'refresh') {
        last.mode = 'consolidate';
        last.transcript = transcript;
        logger.info('Dream queued: refresh superseded by consolidate', { character });
      } else {
        queue.push({ mode, transcript });
        logger.info('Dream queued: consolidate behind in-flight dream', { character });
      }
    } else {
      queue.push({ mode, transcript });
      logger.info('Dream queued: refresh behind in-flight dream', { character });
    }
    pendingDreams.set(character, queue);
    return;
  }

  await startDream(character, mode, transcript);
}
