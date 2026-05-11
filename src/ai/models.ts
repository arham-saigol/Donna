import { createDeepSeek, deepseek } from '@ai-sdk/deepseek';
import { createGateway, gateway } from 'ai';
import { env } from '../config.js';

const flashProvider = createDeepSeek({
  apiKey: env('DEEPSEEK_API_KEY') ?? '',
});

const proProvider = createGateway({
  apiKey: env('AI_GATEWAY_API_KEY') ?? '',
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
