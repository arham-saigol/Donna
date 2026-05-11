import { Chat } from 'chat';
import { createDiscordAdapter, type DiscordAdapter } from '@chat-adapter/discord';
import { experimental_transcribe as transcribe } from 'ai';
import { deepgram } from '@ai-sdk/deepgram';
import { FileStateAdapter } from '../state/file-state.js';
import { getPairedUser, createPairingCode, isPaired } from '../pairing.js';
import {
  handleUserMessage,
  abortAll,
  clearAllSessions,
  initAgent,
  setGlobalModel,
  setGlobalReasoning,
} from '../ai/agent.js';
import { createCharacter, switchCharacter, listCharacters, getActiveCharacter } from '../character/manager.js';
import { readSoul } from '../character/soul.js';
import { logger } from '../logger.js';
import type { Attachment, Thread, Message } from 'chat';

const fileState = new FileStateAdapter();

export const bot = new Chat({
  userName: 'donna',
  adapters: {
    discord: createDiscordAdapter(),
  },
  state: fileState,
  logger: 'info',
  fallbackStreamingPlaceholderText: '...',
  streamingUpdateIntervalMs: 800,
});

// --- Helpers ---

async function requirePairedUser(userId: string): Promise<boolean> {
  const paired = await getPairedUser();
  if (!paired) return false;
  return paired === userId;
}

async function transcribeAttachment(attachment: Attachment): Promise<string | null> {
  try {
    let buffer: Uint8Array;
    if (attachment.fetchData) {
      const data = await attachment.fetchData();
      buffer = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (attachment.url) {
      const res = await fetch(attachment.url);
      if (!res.ok) throw new Error(`Failed to fetch attachment: ${res.status}`);
      const arr = await res.arrayBuffer();
      buffer = new Uint8Array(arr);
    } else {
      return null;
    }

    const result = await transcribe({
      model: deepgram.transcription('nova-3-general'),
      audio: buffer,
    });
    return result.text;
  } catch (err) {
    logger.error('Transcription failed', err);
    return null;
  }
}

async function processMessage(thread: Thread, message: Message) {
  if (message.author.isMe) return;

  const paired = await getPairedUser();
  if (!paired) {
    // Not paired yet; only /pair is allowed (handled by slash commands)
    return;
  }
  if (message.author.userId !== paired) {
    return;
  }

  // Check for voice/audio attachments
  const audioAttachment = message.attachments?.find(
    (a: Attachment) => a.type === 'audio' || a.mimeType?.startsWith('audio/')
  );

  if (audioAttachment) {
    await thread.startTyping();
    const transcript = await transcribeAttachment(audioAttachment);
    if (transcript) {
      await handleUserMessage(transcript, thread, thread.id);
    } else {
      await thread.post('Sorry, I could not transcribe that voice message.');
    }
    return;
  }

  if (message.text) {
    await handleUserMessage(message.text, thread, thread.id);
  }
}

// --- Event Handlers ---

bot.onNewMention(async (thread, message) => {
  if (!thread.isDM) return;

  const paired = await getPairedUser();
  if (!paired) {
    // If not paired, only respond to /pair (slash command)
    return;
  }
  if (message.author.userId !== paired) {
    return;
  }

  await thread.subscribe();
  await processMessage(thread, message);
});

bot.onSubscribedMessage(async (thread, message) => {
  if (!thread.isDM) return;
  await processMessage(thread, message);
});

// --- Slash Commands ---

bot.onSlashCommand('/pair', async (event) => {
  const alreadyPaired = await isPaired();
  if (alreadyPaired && !(await requirePairedUser(event.user.userId))) {
    await event.channel.post('This Donna instance is already paired.');
    return;
  }
  const code = await createPairingCode(event.user.userId);
  await event.channel.post(`Your pairing code is: \`\`\`${code}\`\`\` (valid 10 minutes). Run \`donna pair ${code}\` on the VPS.`);
});

bot.onSlashCommand('/create', async (event) => {
  if (!(await requirePairedUser(event.user.userId))) {
    await event.channel.post('Unauthorized.');
    return;
  }
  const name = event.text.trim();
  if (!name) {
    await event.channel.post('Usage: /create [name]');
    return;
  }
  try {
    await createCharacter(name);
    await switchCharacter(name);
    initAgent(name);
    await event.channel.post(`Character **${name}** created and switched.`);
  } catch (err) {
    logger.error('Create character failed', err);
    await event.channel.post('Failed to create character.');
  }
});

bot.onSlashCommand('/switch', async (event) => {
  if (!(await requirePairedUser(event.user.userId))) {
    await event.channel.post('Unauthorized.');
    return;
  }
  const name = event.text.trim();
  if (!name) {
    await event.channel.post('Usage: /switch [name]');
    return;
  }
  const ok = await switchCharacter(name);
  if (!ok) {
    await event.channel.post(`Character **${name}** does not exist.`);
    return;
  }
  initAgent(name);
  clearAllSessions();
  await event.channel.post(`Switched to **${name}**. New session started.`);
});

bot.onSlashCommand('/soul', async (event) => {
  if (!(await requirePairedUser(event.user.userId))) {
    await event.channel.post('Unauthorized.');
    return;
  }
  const active = await getActiveCharacter();
  if (!active) {
    await event.channel.post('No active character.');
    return;
  }
  const soul = await readSoul(active);
  await event.channel.post(soul ?? 'SOUL.md is empty.');
});

bot.onSlashCommand('/new', async (event) => {
  if (!(await requirePairedUser(event.user.userId))) {
    await event.channel.post('Unauthorized.');
    return;
  }
  clearAllSessions();
  await event.channel.post('New session started with the current character.');
});

bot.onSlashCommand('/abort', async (event) => {
  if (!(await requirePairedUser(event.user.userId))) {
    await event.channel.post('Unauthorized.');
    return;
  }
  abortAll();
  await event.channel.post('Abort signal sent.');
});

bot.onSlashCommand('/reasoning', async (event) => {
  if (!(await requirePairedUser(event.user.userId))) {
    await event.channel.post('Unauthorized.');
    return;
  }
  const level = event.text.trim().toLowerCase();
  if (!['low', 'medium', 'high'].includes(level)) {
    await event.channel.post('Usage: /reasoning [low|medium|high]');
    return;
  }
  setGlobalReasoning(level as 'low' | 'medium' | 'high');
  await event.channel.post(`Reasoning set to **${level}**.`);
});

bot.onSlashCommand('/model', async (event) => {
  if (!(await requirePairedUser(event.user.userId))) {
    await event.channel.post('Unauthorized.');
    return;
  }
  const choice = event.text.trim().toLowerCase();
  if (!['flash', 'pro'].includes(choice)) {
    await event.channel.post('Usage: /model [flash|pro]');
    return;
  }
  setGlobalModel(choice as 'flash' | 'pro');
  await event.channel.post(`Model switched to **${choice}**.`);
});

// Catch-all for unhandled slash commands
bot.onSlashCommand(async (event) => {
  logger.info(`Unhandled slash command: ${event.command} from ${event.user.userId}`);
});

// --- Lifecycle ---

export async function startBot() {
  await bot.initialize();
  await fileState.connect();

  const active = await getActiveCharacter();
  if (active) {
    initAgent(active);
  }

  const discord = bot.getAdapter('discord') as DiscordAdapter;
  logger.info('Starting Discord Gateway listener...');

  // Persistent Gateway loop
  while (true) {
    try {
      await discord.startGatewayListener({}, 10 * 60 * 1000);
    } catch (err) {
      logger.error('Gateway listener error', err);
    }
    logger.info('Gateway listener ended. Reconnecting in 5s...');
    await new Promise((r) => setTimeout(r, 5000));
  }
}
