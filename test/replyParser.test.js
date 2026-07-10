import test from 'node:test';
import assert from 'node:assert';
import { parseReply } from '../src/replyParser.js';

test('OK approves', () => {
  assert.deepEqual(parseReply('OK'), { action: 'approve' });
});

test('approve keywords with punctuation and case', () => {
  for (const t of ['ok!', 'Okay', 'APPROVED', 'yes.', 'approve']) {
    assert.equal(parseReply(t).action, 'approve', t);
  }
});

test('non-keyword body is an edit with that text', () => {
  const r = parseReply('My rewritten post.\nSecond line.');
  assert.deepEqual(r, { action: 'edit', text: 'My rewritten post.\nSecond line.' });
});

test('strips gmail quoted reply', () => {
  const raw = 'New version here\n\nOn Thu, Jul 10, 2026 at 9:01 AM Bot <b@x.com> wrote:\n> old draft line 1\n> old draft line 2';
  assert.deepEqual(parseReply(raw), { action: 'edit', text: 'New version here' });
});

test('OK followed by quoted text still approves', () => {
  const raw = 'OK\n\nOn Thu, Jul 10, 2026 at 9:01 AM Bot <b@x.com> wrote:\n> old draft';
  assert.deepEqual(parseReply(raw), { action: 'approve' });
});

test('empty, null, or only-quoted text is none', () => {
  assert.deepEqual(parseReply(''), { action: 'none' });
  assert.deepEqual(parseReply(null), { action: 'none' });
  assert.deepEqual(parseReply('> quoted only\n> more'), { action: 'none' });
});
