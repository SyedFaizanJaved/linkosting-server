import test from 'node:test';
import assert from 'node:assert';
import { buildDraftsFilter } from '../src/db/draftsFilter.js';

test('no filters -> empty where', () => {
  assert.deepEqual(buildDraftsFilter({}), { where: '', params: [] });
});

test('status only', () => {
  assert.deepEqual(buildDraftsFilter({ status: 'posted' }), { where: 'WHERE status = $1', params: ['posted'] });
});

test('all three filters combine with AND and sequential params', () => {
  const f = buildDraftsFilter({ status: 'pending', topic: 'AI', q: 'price' });
  assert.equal(f.where, 'WHERE status = $1 AND topic = $2 AND (article_title ILIKE $3 OR content ILIKE $3)');
  assert.deepEqual(f.params, ['pending', 'AI', '%price%']);
});

test('rejects unknown status', () => {
  assert.deepEqual(buildDraftsFilter({ status: 'weird' }), { where: '', params: [] });
});
