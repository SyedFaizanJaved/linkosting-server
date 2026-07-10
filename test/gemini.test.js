import test from 'node:test';
import assert from 'node:assert';
import { buildPrompt } from '../src/gemini.js';

test('prompt embeds article, tone, topics, hashtags', () => {
  const p = buildPrompt(
    { title: 'Big AI News', snippet: 'Something happened.', link: 'https://x.com/a' },
    { topics: 'AI, ML', tone: 'friendly expert', hashtags: '#AI' }
  );
  for (const s of ['Big AI News', 'Something happened.', 'AI, ML', 'friendly expert', '#AI']) {
    assert.ok(p.includes(s), `missing: ${s}`);
  }
});
