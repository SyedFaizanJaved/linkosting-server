import test from 'node:test';
import assert from 'node:assert';
import { decideApproval, slotFor, publishDraft } from '../src/jobs/publish.js';

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

// Finding 1 regression: once createPost has succeeded, the draft is posted — period.
// A failure recording linkedin_post_id or sending the confirmation email must NOT
// revert status back to pending/approved (that would cause a double-post next run).
test('publishDraft does not revert status when post-createPost steps fail', async () => {
  const calls = [];
  const result = await publishDraft(1, undefined, {
    getAllSettings: async () => ({ linkedin_token: 't', linkedin_member_urn: 'urn:li:person:x' }),
    query: async (sql) => {
      calls.push(sql.trim());
      if (sql.includes("SET status='posted'")) {
        return { rows: [{ id: 1, status: 'pending', content: 'hello', edited_content: null }] };
      }
      if (sql.includes('linkedin_post_id')) throw new Error('db write failed');
      throw new Error(`unexpected query in test: ${sql}`);
    },
    createPost: async () => 'urn:li:share:123',
    sendMail: async () => { throw new Error('smtp down'); },
  });

  assert.deepEqual(result, { id: 1, result: 'posted', postId: 'urn:li:share:123' });
  assert.ok(
    !calls.some(c => c.includes('posted_at=NULL')),
    'must not issue the revert query once createPost has succeeded'
  );
});

// Bug: UPDATE ... RETURNING * returns POST-update values, so claimed.status was always
// 'posted' — writing that back on createPost failure stranded the draft as 'posted' with
// posted_at=NULL forever (invisible to the due query, and /publish returns 409). The
// revert must always restore 'approved', not whatever claimed.status happened to be.
test('publishDraft reverts to approved and rethrows when createPost fails', async () => {
  const calls = [];
  await assert.rejects(
    publishDraft(1, undefined, {
      getAllSettings: async () => ({ linkedin_token: 't', linkedin_member_urn: 'urn:li:person:x' }),
      query: async (sql, params) => {
        calls.push({ sql: sql.trim(), params });
        if (sql.includes("SET status='posted'")) {
          return { rows: [{ id: 1, status: 'pending', content: 'hello', edited_content: null }] };
        }
        if (sql.includes("SET status='approved'")) return { rows: [] };
        throw new Error(`unexpected query in test: ${sql}`);
      },
      createPost: async () => { throw new Error('linkedin 429'); },
    }),
    /linkedin 429/
  );

  const revert = calls.find(c => c.sql.includes('posted_at=NULL'));
  assert.ok(revert, 'must issue a revert query when createPost throws');
  assert.match(revert.sql, /status='approved'/);
  assert.deepEqual(revert.params, [1]);
});
