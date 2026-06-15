import { createOpenAI } from '@ai-sdk/openai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGateway } from 'ai';
import { env, requireEnv } from '../config.js';

let gatewayProvider: ReturnType<typeof createGateway> | null = null;
function getGatewayProvider() {
  const key = env('AI_GATEWAY_API_KEY');
  if (!key) return null;
  if (!gatewayProvider) {
    gatewayProvider = createGateway({
      apiKey: key,
    });
  }
  return gatewayProvider;
}

let directDeepSeekProvider: ReturnType<typeof createDeepSeek> | null = null;
function getDirectDeepSeekProvider() {
  const key = env('DEEPSEEK_API_KEY');
  if (!key) return null;
  if (!directDeepSeekProvider) {
    directDeepSeekProvider = createDeepSeek({ apiKey: key });
  }
  return directDeepSeekProvider;
}

let stepfunProvider: ReturnType<typeof createOpenAI> | null = null;
function getStepfunProvider() {
  if (!stepfunProvider) {
    stepfunProvider = createOpenAI({
      apiKey: requireEnv('STEPFUN_API_KEY'),
      baseURL: 'https://api.stepfun.ai/v1',
    });
  }
  return stepfunProvider;
}

export function getProModel() {
  // Gateway model ID format: creator/model-name
  return getGatewayProvider()?.languageModel('deepseek/deepseek-v4-pro') ?? null;
}

export function getDeepseekV4ProModel() {
  return getGatewayProvider()?.languageModel('deepseek/deepseek-v4-pro') ?? null;
}

export function getDeepseekV4FlashModel() {
  return getGatewayProvider()?.languageModel('deepseek/deepseek-v4-flash') ?? null;
}

export function getStepfun37FlashModel() {
  return getStepfunProvider()('step-3.7-flash');
}

export const MODEL_TYPES = [
  'Deepseek V4 Pro',
  'Deepseek V4 Flash',
  'Stepfun 3.7 Flash',
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
    default:
      return getProModel();
  }
}

export function getFallbackModel(type: ModelType) {
  const provider = getDirectDeepSeekProvider();
  if (!provider) return null;
  if (type === 'Deepseek V4 Pro') {
    return provider.languageModel('deepseek-v4-pro');
  }
  if (type === 'Deepseek V4 Flash') {
    return provider.languageModel('deepseek-v4-flash');
  }
  return null;
}
