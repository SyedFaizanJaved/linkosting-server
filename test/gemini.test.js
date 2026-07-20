import test from 'node:test';
import assert from 'node:assert';
import { buildPrompt, buildVariantPrompt, ANGLES, buildRequest, parseResponse } from '../src/services/gemini.js';

test('groq builds an OpenAI-shaped chat request with bearer auth', () => {
  process.env.GROQ_API_KEY = 'gk-test';
  process.env.GROQ_MODEL = 'llama-3.3-70b-versatile';
  const r = buildRequest('groq', 'hello');
  assert.match(r.url, /api\.groq\.com/);
  assert.equal(r.headers.authorization, 'Bearer gk-test');
  assert.equal(r.body.model, 'llama-3.3-70b-versatile');
  assert.deepEqual(r.body.messages, [{ role: 'user', content: 'hello' }]);
  assert.ok(!r.url.includes('gk-test'), 'key must not leak into the URL');
});

test('gemini builds a contents-shaped request with the key in the query', () => {
  process.env.GEMINI_API_KEY = 'gm-test';
  const r = buildRequest('gemini', 'hello');
  assert.match(r.url, /generativelanguage\.googleapis\.com/);
  assert.match(r.url, /key=gm-test/);
  assert.equal(r.body.contents[0].parts[0].text, 'hello');
  assert.equal(r.headers.authorization, undefined);
});

test('each provider parses text out of its own response shape', () => {
  assert.equal(parseResponse('groq', { choices: [{ message: { content: '  post  ' } }] }), 'post');
  assert.equal(parseResponse('gemini', { candidates: [{ content: { parts: [{ text: ' post ' }] } }] }), 'post');
});

test('an empty or cross-shaped response throws rather than returning junk', () => {
  assert.throws(() => parseResponse('groq', { candidates: [] }), /groq returned no text/);
  assert.throws(() => parseResponse('gemini', { choices: [] }), /gemini returned no text/);
  assert.throws(() => parseResponse('groq', { choices: [{ message: { content: '' } }] }), /no text/);
});

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
