import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseDreamerResponse } from './dreamer-parser.js';

test('parses a well-formed response', () => {
  const response = `<!-- SOUL.md -->
# SOUL

I am Nova.

<!-- MEMORY.md -->
# MEMORY

- Lives in Boston
`;

  const result = parseDreamerResponse(response);
  assert.ok(result);
  assert.equal(result.soul, '# SOUL\n\nI am Nova.');
  assert.equal(result.memory, '# MEMORY\n\n- Lives in Boston');
});

test('tolerates extra whitespace around block markers', () => {
  const response = `<!--   SOUL.md   -->
# SOUL
x
<!--   MEMORY.md   -->
# MEMORY
y`;

  const result = parseDreamerResponse(response);
  assert.ok(result);
  assert.equal(result.soul, '# SOUL\nx');
  assert.equal(result.memory, '# MEMORY\ny');
});

test('preserves internal whitespace and normalizes boundary whitespace', () => {
  const response = `<!-- SOUL.md -->
  indented
    more
<!-- MEMORY.md -->
other
`;

  const result = parseDreamerResponse(response);
  assert.ok(result);
  // The boundary newlines/spaces after the SOUL marker and before the MEMORY marker
  // are trimmed. Internal whitespace is preserved.
  assert.equal(result.soul, 'indented\n    more');
  assert.equal(result.memory, 'other');
});

test('returns null when SOUL block is missing', () => {
  const response = `<!-- MEMORY.md -->
just memory
`;
  assert.equal(parseDreamerResponse(response), null);
});

test('returns null when MEMORY block is missing', () => {
  const response = `<!-- SOUL.md -->
just soul
`;
  assert.equal(parseDreamerResponse(response), null);
});

test('returns null on completely malformed output', () => {
  assert.equal(parseDreamerResponse('no blocks at all'), null);
  assert.equal(parseDreamerResponse(''), null);
  assert.equal(parseDreamerResponse('<!-- SOUL.md -->\n# SOUL\n'), null);
});

test('handles empty blocks', () => {
  const response = `<!-- SOUL.md -->
<!-- MEMORY.md -->
`;
  const result = parseDreamerResponse(response);
  assert.ok(result);
  assert.equal(result.soul, '');
  assert.equal(result.memory, '');
});

test('strips markdown code fences before parsing', () => {
  const response = '```markdown\n<!-- SOUL.md -->\n# SOUL\nNova\n\n<!-- MEMORY.md -->\n# MEMORY\n- x\n```';
  const result = parseDreamerResponse(response);
  assert.ok(result);
  assert.equal(result.soul, '# SOUL\nNova');
  assert.equal(result.memory, '# MEMORY\n- x');
});
