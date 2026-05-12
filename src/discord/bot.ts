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
import { createCharacter, switchCharacter, getActiveCharacter } from '../character/manager.js';
import { readSoul } from '../character/soul.js';
import { logger } from '../logger.js';
import type { Attachment, Thread, Message } from 'chat';

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
    return;
  }
  if (message.author.userId !== paired) {
    return;
  }

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

// --- Lifecycle ---

export async function startBot() {
  console.log("step 3");
  const fileState = new FileStateAdapter();
  console.log("step 3.1 - FileStateAdapter created");
  console.log("step 3.1a - about to call createDiscordAdapter()");
  console.log("  DISCORD_BOT_TOKEN:", process.env.DISCORD_BOT_TOKEN ? "set" : "MISSING");
  console.log("  DISCORD_PUBLIC_KEY:", process.env.DISCORD_PUBLIC_KEY ? "set" : "MISSING");
  console.log("  DISCORD_APPLICATION_ID:", process.env.DISCORD_APPLICATION_ID ? "set" : "MISSING");
  const discordAdapter = createDiscordAdapter();
  console.log("step 3.1b - createDiscordAdapter() done");
  const bot = new Chat({
    userName: 'donna',
    adapters: {
      discord: discordAdapter,
    },
    state: fileState,
    logger: 'info',
    fallbackStreamingPlaceholderText: '...',
    streamingUpdateIntervalMs: 800,
  });
  console.log("step 3.2 - Chat created");

  // --- Event Handlers ---

  bot.onNewMention(async (thread, message) => {
    if (!thread.isDM) return;

    const paired = await getPairedUser();
    if (!paired) {
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
      const ok = await switchCharacter(name);
      if (!ok) {
        await event.channel.post(`Character **${name}** was created but could not be activated.`);
        return;
      }
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

  bot.onSlashCommand(async (event) => {
    logger.info(`Unhandled slash command: ${event.command} from ${event.user.userId}`);
  });
  console.log("step 3.3 - event handlers registered");

  await bot.initialize();
  console.log("step 3.4 - bot.initialize() done");
  await fileState.connect();
  console.log("step 3.5 - fileState.connect() done");

  const active = await getActiveCharacter();
  console.log("step 3.6 - getActiveCharacter() done, active:", active);
  if (active) {
    initAgent(active);
  }

  const discord = bot.getAdapter('discord') as DiscordAdapter;
  console.log("step 3.7 - discord adapter retrieved:", discord != null);

  // The adapter's setupLegacyGatewayHandlers only registers MessageCreate and
  // reaction events. Slash commands arrive via Gateway as INTERACTION_CREATE but
  // have no handler, so Discord times out with "application did not respond".
  // Patch the instance to also handle interactionCreate.
  const adapterAny = discord as any;
  const _origSetup = adapterAny.setupLegacyGatewayHandlers.bind(adapterAny);
  adapterAny.setupLegacyGatewayHandlers = function (client: any, isShuttingDown: () => boolean) {
    _origSetup(client, isShuttingDown);

    client.on('interactionCreate', async (interaction: any) => {
      if (isShuttingDown()) return;
      if (!interaction.isChatInputCommand()) return;

      logger.info('Slash command received via Gateway', {
        command: interaction.commandName,
        userId: interaction.user?.id,
      });

      // Acknowledge within Discord's 3-second window to avoid "application did not respond"
      try {
        await fetch(
          `https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 5 }), // DeferredChannelMessageWithSource
          },
        );
      } catch (err) {
        logger.error('Failed to acknowledge slash command interaction', err);
        return;
      }

      // Build a Discord API-shaped object so handleApplicationCommandInteraction
      // can set up the request context and call processSlashCommand correctly.
      const rawUser = {
        id: interaction.user.id,
        username: interaction.user.username,
        global_name: interaction.user.globalName ?? null,
        bot: interaction.user.bot ?? false,
      };
      const rawInteraction = {
        id: interaction.id,
        token: interaction.token,
        data: {
          name: interaction.commandName,
          options: interaction.options?.data ?? [],
        },
        member: interaction.member
          ? { user: rawUser }
          : undefined,
        user: rawUser,
        channel_id: interaction.channelId,
        guild_id: interaction.guildId ?? null,
        channel: interaction.channel
          ? { type: interaction.channel.type, parent_id: interaction.channel.parentId ?? null }
          : null,
      };

      adapterAny.handleApplicationCommandInteraction(rawInteraction, {});
    });
  };

  logger.info('Starting Discord Gateway listener...');

  while (true) {
    try {
      let gatewayPromise: Promise<unknown> = Promise.resolve();
      // Use a long duration (7 days) so the connection stays up continuously.
      // Discord.js handles heartbeats and reconnects internally; the outer loop
      // handles the rare case where runGatewayListener itself throws.
      await discord.startGatewayListener(
        { waitUntil: (p) => { gatewayPromise = p; } },
        7 * 24 * 60 * 60 * 1000,
      );
      await gatewayPromise;
    } catch (err) {
      logger.error('Gateway listener error', err);
    }
    logger.info('Gateway listener ended. Reconnecting in 5s...');
    await new Promise((r) => setTimeout(r, 5000));
  }
}
