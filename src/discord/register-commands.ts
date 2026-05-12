import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/rest/v10';
import { requireEnv } from '../config.js';

const COMMANDS = [
  {
    name: 'pair',
    description: 'Pair your Discord account with this Donna instance',
  },
  {
    name: 'create',
    description: 'Create a new character',
    options: [
      {
        type: 3, // STRING
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
        type: 3,
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
        type: 3,
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
        type: 3,
        name: 'model',
        description: 'Model to use',
        required: true,
        choices: [
          { name: 'flash', value: 'flash' },
          { name: 'pro', value: 'pro' },
        ],
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
