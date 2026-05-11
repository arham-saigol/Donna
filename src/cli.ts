#!/usr/bin/env node

import { spawn, execSync } from 'node:child_process';
import { existsSync, createReadStream, statSync } from 'node:fs';
import { readFile, writeFile, access } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PID_FILE,
  PAIRED_USER_FILE,
  ACTIVE_CHARACTER_FILE,
  ROOT,
  DATA_DIR,
} from './config.js';
import { validatePairingCode, getPairedUser } from './pairing.js';
import { getActiveCharacter } from './character/manager.js';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const daemonPath = join(__dirname, 'daemon.js');

const args = process.argv.slice(2);
const command = args[0] ?? 'help';

async function isProcessRunning(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readPid(): Promise<number | null> {
  try {
    const text = await readFile(PID_FILE, 'utf-8');
    const pid = parseInt(text.trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

// --- setup ---

async function setupWizard() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log('=== Donna Setup Wizard ===\n');

  // Dependency check
  const nodeVersion = process.version;
  console.log(`Node.js: ${nodeVersion}`);
  const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  if (major < 20) {
    console.warn('WARNING: Node.js 20+ is required.');
  }

  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
    console.log('ffmpeg: OK');
  } catch {
    console.warn('ffmpeg not found. Donna voice support requires ffmpeg.');
    const install = await rl.question('Try to install ffmpeg via apt? (y/n): ');
    if (install.trim().toLowerCase() === 'y') {
      try {
        execSync('sudo apt-get update && sudo apt-get install -y ffmpeg', { stdio: 'inherit' });
      } catch {
        console.error('Failed to install ffmpeg. Please install it manually: sudo apt-get install ffmpeg');
      }
    }
  }

  const ask = async (label: string): Promise<string> => {
    const val = await rl.question(`${label} (press Enter to skip): `);
    return val.trim();
  };

  const deepseekKey = await ask('Deepseek API Key');
  const gatewayKey = await ask('Vercel AI Gateway API Key');
  const deepgramKey = await ask('Deepgram API Key');
  const discordToken = await ask('Discord Bot Token');
  const discordAppId = await ask('Discord Application ID');

  const envLines: string[] = [];
  if (deepseekKey) envLines.push(`DEEPSEEK_API_KEY=${deepseekKey}`);
  if (gatewayKey) envLines.push(`AI_GATEWAY_API_KEY=${gatewayKey}`);
  if (deepgramKey) envLines.push(`DEEPGRAM_API_KEY=${deepgramKey}`);
  if (discordToken) envLines.push(`DISCORD_BOT_TOKEN=${discordToken}`);
  if (discordAppId) envLines.push(`DISCORD_APPLICATION_ID=${discordAppId}`);

  if (envLines.length > 0) {
    await writeFile(join(ROOT, '.env'), envLines.join('\n') + '\n', 'utf-8');
    console.log('\nSaved to .env');
  } else {
    console.log('\nNo keys provided — skipped saving .env');
  }

  console.log('\nSetup complete! Run `donna start`, then use `/pair` in Discord.');
  rl.close();
}

// --- start ---

async function startDaemon() {
  const existing = await readPid();
  if (existing && (await isProcessRunning(existing))) {
    console.log(`Donna is already running (PID ${existing}).`);
    return;
  }

  const child = spawn(process.execPath, [daemonPath], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  // Write PID after a brief delay so daemon can also write it
  await new Promise((r) => setTimeout(r, 500));
  try {
    await writeFile(PID_FILE, String(child.pid), 'utf-8');
  } catch {
    // ignore
  }

  console.log(`Donna daemon started (PID ${child.pid}).`);
}

// --- stop ---

async function stopDaemon() {
  const pid = await readPid();
  if (!pid) {
    console.log('Donna is not running (no PID file).');
    return;
  }
  if (!(await isProcessRunning(pid))) {
    console.log('Donna is not running (stale PID file).');
    try { await writeFile(PID_FILE, '', 'utf-8'); } catch {}
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
    console.log(`Sent stop signal to Donna (PID ${pid}).`);
  } catch {
    console.log('Failed to stop Donna. You may need to kill the process manually.');
  }
}

// --- status ---

async function showStatus() {
  const pid = await readPid();
  const running = pid ? await isProcessRunning(pid) : false;
  const character = await getActiveCharacter();
  const paired = await getPairedUser();

  console.log(`Status: ${running ? 'RUNNING' : 'STOPPED'}`);
  if (running && pid) console.log(`PID: ${pid}`);
  console.log(`Character: ${character ?? 'none'}`);
  console.log(`Paired user: ${paired ?? 'none'}`);
}

// --- logs ---

async function tailLogs() {
  const logPath = join(DATA_DIR, 'logs', 'donna.log');
  if (!existsSync(logPath)) {
    console.log('No log file found.');
    return;
  }

  // Print last ~50 lines
  const stats = statSync(logPath);
  const start = Math.max(0, stats.size - 1024 * 50);
  const stream = createReadStream(logPath, { start, encoding: 'utf-8' });
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk;
  });
  stream.on('end', () => {
    const lines = buffer.split('\n').slice(-50);
    for (const line of lines) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);
          console.log(`[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`);
        } catch {
          console.log(line);
        }
      }
    }
    console.log('\n--- End of log tail ---');
  });
}

// --- pair ---

async function cliPair(code: string) {
  if (!code) {
    console.log('Usage: donna pair [CODE]');
    return;
  }
  const userId = await validatePairingCode(code);
  if (userId) {
    console.log(`Pairing successful! Discord user ${userId} is now paired.`);
  } else {
    console.log('Invalid or expired pairing code.');
  }
}

// --- help ---

function showHelp() {
  console.log(`Donna CLI

Usage: donna <command>

Commands:
  setup              Interactive onboarding wizard
  start              Start the Donna daemon
  stop               Stop the Donna daemon
  status             Show daemon status
  logs               Tail recent daemon logs
  pair [CODE]        Complete pairing using Discord code
  help               Show this help
`);
}

// --- main ---

async function main() {
  switch (command) {
    case 'setup':
      await setupWizard();
      break;
    case 'start':
      await startDaemon();
      break;
    case 'stop':
      await stopDaemon();
      break;
    case 'status':
      await showStatus();
      break;
    case 'logs':
      await tailLogs();
      break;
    case 'pair':
      await cliPair(args[1] ?? '');
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

main().catch((err) => {
  logger.error('CLI error', err);
  console.error(err);
  process.exit(1);
});
