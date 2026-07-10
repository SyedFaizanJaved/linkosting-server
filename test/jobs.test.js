import test from 'node:test';
import assert from 'node:assert';
import { decideApproval, slotFor } from '../src/jobs/publish.js';

const draft = { status: 'pending', content: 'generated text', edited_content: null };

test('dashboard-approved draft publishes its edited text', () => {
  const d = { ...draft, status: 'approved', edited_content: 'edited' };
  assert.deepEqual(decideApproval(d, null), { approved: true, text: 'edited' });
});

test('dashboard approval wins over a conflicting email edit', () => {
  const d = { ...draft, status: 'approved' };
  assert.deepEqual(decideApproval(d, 'email edit'), { approved: true, text: 'generated text' });
});

test('email OK approves the generated text', () => {
  assert.deepEqual(decideApproval(draft, 'OK'), { approved: true, text: 'generated text' });
});

test('email edit replaces the text', () => {
  assert.deepEqual(decideApproval(draft, 'better text'), { approved: true, text: 'better text' });
});

test('no reply means not approved', () => {
  assert.deepEqual(decideApproval(draft, null), { approved: false });
});

test('slotFor returns today at HH:MM UTC', () => {
  const now = new Date('2026-07-10T03:00:00Z');
  assert.equal(slotFor('12:30', now).toISOString(), '2026-07-10T12:30:00.000Z');
});
