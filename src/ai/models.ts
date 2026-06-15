import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createGateway } from 'ai';
import { requireEnv } from '../config.js';

const gatewayProvider = createGateway({
  apiKey: requireEnv('AI_GATEWAY_API_KEY'),
});

const openrouter = createOpenRouter({
  apiKey: requireEnv('OPENROUTER_API_KEY'),
});

const openrouterProvider = (modelId: string) => openrouter.chat(modelId);

const stepfunProvider = createOpenAI({
  apiKey: requireEnv('STEPFUN_API_KEY'),
  baseURL: 'https://api.stepfun.ai/v1',
});

export function getProModel() {
  // Gateway model ID format: creator/model-name
  return gatewayProvider.languageModel('deepseek/deepseek-v4-pro');
}

export function getDeepseekV4ProModel() {
  return gatewayProvider.languageModel('deepseek/deepseek-v4-pro');
}

export function getDeepseekV4FlashModel() {
  return gatewayProvider.languageModel('deepseek/deepseek-v4-flash');
}

export function getNexN2ProModel() {
  return openrouterProvider('nex-agi/nex-n2-pro:free');
}

export function getStepfun37FlashModel() {
  return stepfunProvider('step-3.7-flash');
}

export const MODEL_TYPES = [
  'Deepseek V4 Pro',
  'Deepseek V4 Flash',
  'Stepfun 3.7 Flash',
  'Nex N2 Pro',
] as const;

export type ModelType = (typeof MODEL_TYPES)[number];

export function getCurrentModel(type: ModelType) {
  switch (type) {
    case 'Deepseek V4 Pro':
      return getDeepseekV4ProModel();
    case 'Deepseek V4 Flash':
      return getDeepseekV4FlashModel();
    case 'Stepfun 3.7 Flash':
      return getStepfun37FlashModel();
    case 'Nex N2 Pro':
      return getNexN2ProModel();
    default:
      return getProModel();
  }
}
