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

test('daily prompt includes the source link and asks for post-specific hashtags', () => {
  const p = buildPrompt(
    { title: 'T', snippet: 'S', link: 'https://news.example.com/story' },
    { topics: 'AI', tone: 't', hashtags: '#AI' }
  );
  assert.ok(p.includes('Read more: https://news.example.com/story'), 'source link missing');
  assert.ok(/hashtags that genuinely fit/i.test(p), 'post-specific hashtag instruction missing');
});

test('variant prompt forbids inventing URLs and asks for post-specific hashtags', () => {
  const p = buildVariantPrompt(
    { prompt: 'x', tone: 'bold', length: 'short', angle: ANGLES[0] },
    { topics: 'AI', tone: 't', hashtags: '#AI' }
  );
  assert.ok(/never invent one/i.test(p), 'no-URL instruction missing');
  assert.ok(/hashtags that genuinely fit/i.test(p), 'post-specific hashtag instruction missing');
});
