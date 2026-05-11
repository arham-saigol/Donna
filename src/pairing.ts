import { randomBytes } from 'node:crypto';
import { PAIRING_CODES_FILE, PAIRED_USER_FILE } from './config.js';
import { readJson, writeJson } from './utils/files.js';

interface PairingCode {
  code: string;
  discordUserId: string;
  expiresAt: number;
}

function generateCode(): string {
  return randomBytes(3).toString('hex').toUpperCase();
}

export async function createPairingCode(discordUserId: string): Promise<string> {
  const codes = (await readJson<Record<string, PairingCode>>(PAIRING_CODES_FILE)) ?? {};
  // Clean expired codes
  const now = Date.now();
  for (const key of Object.keys(codes)) {
    if (codes[key].expiresAt < now) {
      delete codes[key];
    }
  }
  const code = generateCode();
  codes[code] = {
    code,
    discordUserId,
    expiresAt: now + 10 * 60 * 1000, // 10 minutes
  };
  await writeJson(PAIRING_CODES_FILE, codes);
  return code;
}

export async function validatePairingCode(code: string): Promise<string | null> {
  const codes = (await readJson<Record<string, PairingCode>>(PAIRING_CODES_FILE)) ?? {};
  const entry = codes[code.toUpperCase().trim()];
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    delete codes[code.toUpperCase().trim()];
    await writeJson(PAIRING_CODES_FILE, codes);
    return null;
  }
  // Pairing successful — save paired user and clear all codes
  await writeJson(PAIRED_USER_FILE, { discordUserId: entry.discordUserId, pairedAt: Date.now() });
  await writeJson(PAIRING_CODES_FILE, {});
  return entry.discordUserId;
}

export async function getPairedUser(): Promise<string | null> {
  const data = await readJson<{ discordUserId: string }>(PAIRED_USER_FILE);
  return data?.discordUserId ?? null;
}

export async function isPaired(): Promise<boolean> {
  return (await getPairedUser()) !== null;
}
