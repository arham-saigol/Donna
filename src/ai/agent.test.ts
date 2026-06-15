import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  getReasoningOptions,
  buildProviderOptions,
  type ModelType,
} from './agent.js';

const DEEPSEEK_MODELS: ModelType[] = ['Deepseek V4 Pro', 'Deepseek V4 Flash'];

test('getReasoningOptions returns DeepSeek options for V4 models', () => {
  for (const model of DEEPSEEK_MODELS) {
    const info = getReasoningOptions(model);
    assert.ok(info);
    assert.deepEqual(info!.levels, ['low', 'medium', 'high']);
    assert.equal(info!.mapping.low, 'thinking disabled');
    assert.equal(info!.mapping.medium, 'thinking enabled, effort high');
    assert.equal(info!.mapping.high, 'thinking enabled, effort max');
  }
});

test('getReasoningOptions returns null for Stepfun', () => {
  assert.equal(getReasoningOptions('Stepfun 3.7 Flash'), null);
});

test('buildProviderOptions disables thinking for low on DeepSeek models', () => {
  for (const model of DEEPSEEK_MODELS) {
    const opts = buildProviderOptions(model, 'low');
    assert.deepEqual(opts.deepseek.thinking, { type: 'disabled' });
    assert.equal(opts.deepseek.reasoningEffort, undefined);
  }
});

test('buildProviderOptions enables high-effort thinking for medium on DeepSeek models', () => {
  for (const model of DEEPSEEK_MODELS) {
    const opts = buildProviderOptions(model, 'medium');
    assert.deepEqual(opts.deepseek.thinking, { type: 'enabled' });
    assert.equal(opts.deepseek.reasoningEffort, 'high');
  }
});

test('buildProviderOptions enables max-effort thinking for high on DeepSeek models', () => {
  for (const model of DEEPSEEK_MODELS) {
    const opts = buildProviderOptions(model, 'high');
    assert.deepEqual(opts.deepseek.thinking, { type: 'enabled' });
    assert.equal(opts.deepseek.reasoningEffort, 'max');
  }
});

test('buildProviderOptions returns empty object for Stepfun', () => {
  assert.deepEqual(buildProviderOptions('Stepfun 3.7 Flash', 'low'), {});
  assert.deepEqual(buildProviderOptions('Stepfun 3.7 Flash', 'medium'), {});
  assert.deepEqual(buildProviderOptions('Stepfun 3.7 Flash', 'high'), {});
});
