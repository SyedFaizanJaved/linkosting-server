import test from 'node:test';
import assert from 'node:assert';
import { deriveNotifications } from '../src/services/notifications.js';

const NOW = new Date('2026-07-10T12:00:00Z');

test('pending draft yields review notification', () => {
  const n = deriveNotifications(
    [{ id: 1, status: 'pending', article_title: 'T', created_at: '2026-07-10T04:00:00Z' }], {}, NOW);
  assert.equal(n[0].type, 'review');
  assert.equal(n[0].draftId, 1);
});

test('recent post yields posted notification, old post does not', () => {
  const drafts = [
    { id: 2, status: 'posted', article_title: 'New', posted_at: '2026-07-09T12:00:00Z' },
    { id: 3, status: 'posted', article_title: 'Old', posted_at: '2026-07-01T12:00:00Z' },
  ];
  const n = deriveNotifications(drafts, {}, NOW);
  assert.deepEqual(n.map(x => x.draftId), [2]);
});

test('token expiring within 7 days yields warning; missing expiry does not', () => {
  const soon = new Date(NOW.getTime() + 5 * 86400000).toISOString();
  const n = deriveNotifications([], { linkedin_token_expires_at: soon }, NOW);
  assert.equal(n[0].type, 'token');
  assert.deepEqual(deriveNotifications([], {}, NOW), []);
});
