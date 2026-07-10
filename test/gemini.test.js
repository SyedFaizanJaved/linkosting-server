import test from 'node:test';
import assert from 'node:assert';
import { buildPrompt, buildVariantPrompt, ANGLES } from '../src/services/gemini.js';

test('prompt embeds article, tone, topics, hashtags', () => {
  const p = buildPrompt(
    { title: 'Big AI News', snippet: 'Something happened.', link: 'https://x.com/a' },
    { topics: 'AI, ML', tone: 'friendly expert', hashtags: '#AI' }
  );
  for (const s of ['Big AI News', 'Something happened.', 'AI, ML', 'friendly expert', '#AI']) {
    assert.ok(p.includes(s), `missing: ${s}`);
  }
});

test('variant prompt embeds prompt, tone, length band, angle, persona, hashtags', () => {
  const p = buildVariantPrompt(
    { prompt: 'pricing lessons', tone: 'bold', length: 'short', angle: ANGLES[1] },
    { topics: 'AI', tone: 'first person, no hype', hashtags: '#AI' }
  );
  for (const s of ['pricing lessons', 'bold', '60-100', ANGLES[1], 'first person, no hype', '#AI']) {
    assert.ok(p.includes(s), `missing: ${s}`);
  }
});

test('unknown length falls back to medium band', () => {
  const p = buildVariantPrompt(
    { prompt: 'x', tone: 'professional', length: 'huge', angle: ANGLES[0] },
    { topics: 'AI', tone: 't', hashtags: '#A' }
  );
  assert.ok(p.includes('120-180'));
});
