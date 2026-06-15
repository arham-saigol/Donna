import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { splitMessage } from './split-message.js';

test('returns short text unchanged', () => {
  const text = 'Hello, world!';
  assert.deepEqual(splitMessage(text, 2000), [text]);
});

test('returns text of exactly the max length unchanged', () => {
  const text = 'a'.repeat(2000);
  assert.deepEqual(splitMessage(text, 2000), [text]);
});

test('throws when maxLength is zero', () => {
  assert.throws(() => splitMessage('hello', 0), /positive integer/);
});

test('throws when maxLength is negative', () => {
  assert.throws(() => splitMessage('hello', -1), /positive integer/);
});

test('splits at paragraph boundaries when possible', () => {
  const part = 'a'.repeat(500);
  const text = `${part}\n\n${part}\n\n${part}`;
  const chunks = splitMessage(text, 1200);
  assert.ok(chunks.every((c) => c.length <= 1200));
  assert.equal(chunks.join('\n\n'), text);
});

test('splits a long single paragraph at word boundaries', () => {
  const words = Array.from({ length: 300 }, (_, i) => `word${i}`);
  const text = words.join(' ');
  const chunks = splitMessage(text, 200);
  assert.ok(chunks.every((c) => c.length <= 200));
  assert.equal(chunks.join(' '), text);
});

test('falls back to hard boundaries for a single word exceeding the limit', () => {
  const text = 'a'.repeat(5500);
  const chunks = splitMessage(text, 2000);
  assert.ok(chunks.every((c) => c.length <= 2000));
  assert.equal(chunks.join(''), text);
});

test('returns an empty string as one chunk', () => {
  assert.deepEqual(splitMessage('', 2000), ['']);
});
