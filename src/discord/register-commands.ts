import { REST } from '@discordjs/rest';
import type { RESTPutAPIApplicationCommandsJSONBody } from 'discord-api-types/rest/v10';
import { Routes } from 'discord-api-types/rest/v10';
import { ApplicationCommandOptionType } from 'discord-api-types/v10';
import { requireEnv } from '../config.js';

const COMMANDS: RESTPutAPIApplicationCommandsJSONBody = [
  {
    name: 'pair',
    description: 'Pair your Discord account with this Donna instance',
  },
  {
    name: 'create',
    description: 'Create a new character',
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'name',
        description: 'Character name',
        required: true,
      },
    ],
  },
  {
    name: 'switch',
    description: 'Switch to an existing character',
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'name',
        description: 'Character name',
        required: true,
      },
    ],
  },
  {
    name: 'soul',
    description: "Read the active character's SOUL.md",
  },
  {
    name: 'new',
    description: 'Start a new session with the current character',
  },
  {
    name: 'abort',
    description: 'Abort all in-progress AI responses',
  },
  {
    name: 'reasoning',
    description: 'Set the reasoning level',
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'level',
        description: 'Reasoning level',
        required: true,
        choices: [
          { name: 'low', value: 'low' },
          { name: 'medium', value: 'medium' },
          { name: 'high', value: 'high' },
        ],
      },
    ],
  },
  {
    name: 'model',
    description: 'Switch the AI model',
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'model',
        description: 'Model to use',
        required: true,
        choices: [
          { name: 'flash', value: 'flash' },
          { name: 'pro', value: 'pro' },
          { name: 'minimax-m3', value: 'minimax-m3' },
          { name: 'kimi-k2.6', value: 'kimi-k2.6' },
          { name: 'gpt-5.5', value: 'gpt-5.5' },
          { name: 'nemotron-3-ultra', value: 'nemotron-3-ultra' },
        ],
      },
    ],
  },
  {
    name: 'deletebot',
    description: 'Permanently delete a bot by name',
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'name',
        description: 'Bot name to delete',
        required: true,
      },
    ],
  },
];

export async function registerCommands(guildId?: string): Promise<void> {
  const token = requireEnv('DISCORD_BOT_TOKEN');
  const appId = requireEnv('DISCORD_APPLICATION_ID');

  const rest = new REST({ version: '10' }).setToken(token);

  const route = guildId
    ? Routes.applicationGuildCommands(appId, guildId)
    : Routes.applicationCommands(appId);

  const scope = guildId ? `guild ${guildId}` : 'global';
  console.log(`Registering ${COMMANDS.length} commands (${scope})...`);

  await rest.put(route, { body: COMMANDS });

  console.log(`Registered ${COMMANDS.length} slash commands (${scope}).`);
  if (!guildId) {
    console.log('Note: global commands can take up to 1 hour to propagate.');
    console.log('Use --guild <GUILD_ID> for instant registration on a specific server.');
  }
}
