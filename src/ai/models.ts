import { createDeepSeek, deepseek } from '@ai-sdk/deepseek';
import { createGateway, gateway } from 'ai';
import { requireEnv } from '../config.js';

const flashProvider = createDeepSeek({
  apiKey: requireEnv('DEEPSEEK_API_KEY'),
});

const gatewayProvider = createGateway({
  apiKey: requireEnv('AI_GATEWAY_API_KEY'),
});

export function getFlashModel() {
  return flashProvider('deepseek-v4-flash');
}

export function getProModel() {
  // Gateway model ID format: creator/model-name
  return gatewayProvider.languageModel('deepseek/deepseek-v4-pro');
}

export function getMinimaxM3Model() {
  return gatewayProvider.languageModel('minimax/minimax-m3');
}

export function getKimiK26Model() {
  return gatewayProvider.languageModel('moonshotai/kimi-k2.6');
}

export function getGpt55Model() {
  return gatewayProvider.languageModel('openai/gpt-5.5');
}

export function getNemotron3UltraModel() {
  return gatewayProvider.languageModel('nvidia/nemotron-3-ultra-550b-a55b');
}

export const MODEL_TYPES = [
  'flash',
  'pro',
  'minimax-m3',
  'kimi-k2.6',
  'gpt-5.5',
  'nemotron-3-ultra',
] as const;

export type ModelType = (typeof MODEL_TYPES)[number];

export function getCurrentModel(type: ModelType) {
  switch (type) {
    case 'pro':
      return getProModel();
    case 'minimax-m3':
      return getMinimaxM3Model();
    case 'kimi-k2.6':
      return getKimiK26Model();
    case 'gpt-5.5':
      return getGpt55Model();
    case 'nemotron-3-ultra':
      return getNemotron3UltraModel();
    default:
      return getFlashModel();
  }
}
