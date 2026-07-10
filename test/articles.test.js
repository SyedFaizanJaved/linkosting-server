import test from 'node:test';
import assert from 'node:assert';
import { pickFresh } from '../src/articles.js';

const items = [
  { title: 'Old', link: 'https://a.com/old', snippet: '', isoDate: '2026-07-01T00:00:00Z' },
  { title: 'New', link: 'https://a.com/new', snippet: '', isoDate: '2026-07-09T00:00:00Z' },
  { title: 'Mid', link: 'https://a.com/mid', snippet: '', isoDate: '2026-07-05T00:00:00Z' },
];

test('picks newest item', () => {
  assert.equal(pickFresh(items, []).title, 'New');
});

test('skips already-used URLs', () => {
  assert.equal(pickFresh(items, ['https://a.com/new']).title, 'Mid');
});

test('returns null when everything is used', () => {
  assert.equal(pickFresh(items, items.map(i => i.link)), null);
});

test('ignores items without a link', () => {
  assert.equal(pickFresh([{ title: 'x', link: '', isoDate: '2026-07-09T00:00:00Z' }], []), null);
});
