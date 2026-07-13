import { query, getAllSettings } from '../db/index.js';
import { getUserSettings } from '../db/userSettings.js';
import { parseReply } from '../services/replyParser.js';
import { fetchApprovalReply, sendMail } from '../services/email.js';
import { createPost } from '../services/linkedin.js';

export function decideApproval(draft, replyText) {
  if (draft.status === 'approved') {
    return { approved: true, text: draft.edited_content || draft.content };
  }
  const parsed = parseReply(replyText);
  if (parsed.action === 'approve') return { approved: true, text: draft.edited_content || draft.content };
  if (parsed.action === 'edit') return { approved: true, text: parsed.text };
  return { approved: false };
}

export function slotFor(hhmm, now = new Date()) {
  const [h, m] = (hhmm || '12:00').split(':').map(Number);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m));
  if (d < now) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

// deps param exists solely so tests can fake createPost/query/sendMail without a DB or network call.
// userId scopes the claim to that user's drafts and their settings; omit it (existing tests, and
// runPublish's pre-Task-6 call) to fall back to the unscoped global-settings behavior.
export async function publishDraft(id, overrideText, deps = {}, userId) {
  const {
    getAllSettings: _getAllSettings = getAllSettings,
    getUserSettings: _getUserSettings = getUserSettings,
    query: _query = query,
    createPost: _createPost = createPost,
    sendMail: _sendMail = sendMail,
  } = deps;

  const s = userId != null ? await _getUserSettings(userId) : await _getAllSettings();
  if (!s.linkedin_token || !s.linkedin_member_urn) {
    throw new Error('LinkedIn not connected — open Settings and click Connect LinkedIn.');
  }
  const { rows: [claimed] } = await _query(
    `WITH prev AS (SELECT status FROM drafts WHERE id=$1)
     UPDATE drafts SET status='posted', posted_at=now()
     WHERE id=$1 ${userId != null ? 'AND user_id=$2' : ''} AND status IN ('pending','approved')
     RETURNING drafts.*, (SELECT status FROM prev) AS prev_status`,
    userId != null ? [id, userId] : [id]
  );
  if (!claimed) throw new Error('draft not found or already posted');
  const text = overrideText || claimed.edited_content || claimed.content;

  let postId;
  try {
    const image = claimed.image ? { bytes: claimed.image, mime: claimed.image_mime } : null;
    postId = await _createPost(text, s.linkedin_token, s.linkedin_member_urn, image);
  } catch (e) {
    await _query(`UPDATE drafts SET status=$2, posted_at=NULL WHERE id=$1`, [id, claimed.prev_status]);
    throw e;
  }

  // createPost succeeded: the draft IS posted, permanently. Nothing below may revert it —
  // failures here are logged/swallowed, never rethrown.
  await _query('UPDATE drafts SET linkedin_post_id=$2, edited_content=$3 WHERE id=$1', [id, postId, text])
    .catch(err => console.error(`Failed to record linkedin_post_id for draft ${id}:`, err));
  await _sendMail('Posted to LinkedIn ✔', `${text}\n\nhttps://www.linkedin.com/feed/update/${postId}/`).catch(() => {});

  return { id, result: 'posted', postId };
}

// Runs the 4-step publish pipeline for a single user's drafts. Any error thrown here
// (e.g. the IMAP approval-reply fetch) is caught by the per-user loop in runPublish.
async function runPublishForUser(userId, email, dryRun) {
  const s = await getUserSettings(userId);
  const published = [];

  // 1. Apply email approval to today's pending daily draft
  const { rows: [daily] } = await query(
    `SELECT * FROM drafts WHERE user_id=$1 AND source='daily' AND status='pending'
     AND created_at::date = now()::date ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  if (daily) {
    const reply = await fetchApprovalReply(daily.id);
    const decision = decideApproval(daily, reply);
    if (decision.approved) {
      await query(
        `UPDATE drafts SET status='approved', edited_content=$2,
         scheduled_at=COALESCE(scheduled_at, $3) WHERE id=$1 AND status='pending'`,
        [daily.id, decision.text, slotFor(s.default_post_time)]
      );
    }
  }

  // 2. Approved drafts without a slot get today's default slot
  await query(
    `UPDATE drafts SET scheduled_at=$2 WHERE user_id=$1 AND status='approved' AND scheduled_at IS NULL`,
    [userId, slotFor(s.default_post_time)]
  );

  // 3. Skip yesterday-or-older daily drafts never approved
  await query(
    `UPDATE drafts SET status='skipped'
     WHERE user_id=$1 AND source='daily' AND status='pending' AND created_at::date < now()::date`,
    [userId]
  );

  // 4. Publish everything approved and due
  if (!s.linkedin_token || !s.linkedin_member_urn) return published;
  const { rows: due } = await query(
    `SELECT id FROM drafts WHERE user_id=$1 AND status='approved' AND scheduled_at <= now() ORDER BY scheduled_at`,
    [userId]
  );
  for (const { id } of due) {
    if (dryRun) { published.push({ id, result: 'dry-run' }); continue; }
    try {
      published.push(await publishDraft(id, undefined, {}, userId));
    } catch (e) {
      await sendMail('LinkedIn automation FAILED: publish', String(e.stack || e), email).catch(() => {});
      published.push({ id, result: 'error', error: String(e.message || e) });
    }
  }
  return published;
}

export async function runPublish({ dryRun = false } = {}) {
  const { rows: users } = await query(`SELECT id, email FROM users WHERE status='active'`);
  const published = [];
  for (const { id: userId, email } of users) {
    try {
      published.push(...await runPublishForUser(userId, email, dryRun));
    } catch (e) {
      await sendMail('LinkedIn automation FAILED: publish', String(e.stack || e), email).catch(() => {});
    }
  }
  return { published };
}
