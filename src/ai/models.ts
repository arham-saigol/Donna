import { createDeepSeek, deepseek } from '@ai-sdk/deepseek';
import { createGateway, gateway } from 'ai';
import { requireEnv } from '../config.js';

const flashProvider = createDeepSeek({
  apiKey: requireEnv('DEEPSEEK_API_KEY'),
});

const proProvider = createGateway({
  apiKey: requireEnv('AI_GATEWAY_API_KEY'),
});

export function getFlashModel() {
  return flashProvider('deepseek-v4-flash');
}

export function getProModel() {
  // Gateway model ID format: creator/model-name
  return proProvider.languageModel('deepseek/deepseek-v4-pro');
}

export function getCurrentModel(type: 'flash' | 'pro') {
  return type === 'pro' ? getProModel() : getFlashModel();
}
