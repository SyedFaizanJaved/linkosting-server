import test from 'node:test';
import assert from 'node:assert';
import { buildImagePrompt } from '../src/services/image.js';

test('image prompt embeds the post text and forbids text-in-image', () => {
  const p = buildImagePrompt('Lessons from my first year of consulting.', { tone: 'warm, practical' });
  assert.ok(p.includes('Lessons from my first year of consulting.'), 'includes post text');
  assert.ok(/no text|no words|no letters/i.test(p), 'forbids embedded text');
  assert.ok(p.includes('warm, practical'), 'includes tone');
});
