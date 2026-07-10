import { query, getAllSettings } from '../db/index.js';
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
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m));
}

export async function publishDraft(id, overrideText) {
  const s = await getAllSettings();
  if (!s.linkedin_token || !s.linkedin_member_urn) {
    throw new Error('LinkedIn not connected — open Settings and click Connect LinkedIn.');
  }
  const { rows: [claimed] } = await query(
    `UPDATE drafts SET status='posted', posted_at=now()
     WHERE id=$1 AND status IN ('pending','approved') RETURNING *`, [id]
  );
  if (!claimed) throw new Error('draft not found or already posted');
  const text = overrideText || claimed.edited_content || claimed.content;
  try {
    const postId = await createPost(text, s.linkedin_token, s.linkedin_member_urn);
    await query('UPDATE drafts SET linkedin_post_id=$2, edited_content=$3 WHERE id=$1', [id, postId, text]);
    await sendMail('Posted to LinkedIn ✔', `${text}\n\nhttps://www.linkedin.com/feed/update/${postId}/`);
    return { id, result: 'posted', postId };
  } catch (e) {
    await query('UPDATE drafts SET status=$2, posted_at=NULL WHERE id=$1', [id, claimed.status]);
    throw e;
  }
}

export async function runPublish({ dryRun = false } = {}) {
  const s = await getAllSettings();

  if (s.linkedin_token_expires_at) {
    const daysLeft = Math.floor((new Date(s.linkedin_token_expires_at) - Date.now()) / 86400000);
    if (daysLeft <= 7) {
      await sendMail(
        `Action needed: LinkedIn token expires in ${daysLeft} day(s)`,
        'Open the dashboard Settings page and click "Connect LinkedIn" to refresh it.'
      );
    }
  }

  // 1. Apply email approval to today's pending daily draft
  const { rows: [daily] } = await query(
    `SELECT * FROM drafts WHERE source='daily' AND status='pending'
     AND created_at::date = now()::date ORDER BY created_at DESC LIMIT 1`
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
    `UPDATE drafts SET scheduled_at=$1 WHERE status='approved' AND scheduled_at IS NULL`,
    [slotFor(s.default_post_time)]
  );

  // 3. Skip yesterday-or-older daily drafts never approved
  await query(
    `UPDATE drafts SET status='skipped'
     WHERE source='daily' AND status='pending' AND created_at::date < now()::date`
  );

  // 4. Publish everything approved and due
  const { rows: due } = await query(
    `SELECT id FROM drafts WHERE status='approved' AND scheduled_at <= now() ORDER BY scheduled_at`
  );
  const published = [];
  for (const { id } of due) {
    if (dryRun) { published.push({ id, result: 'dry-run' }); continue; }
    try {
      published.push(await publishDraft(id));
    } catch (e) {
      await sendMail('LinkedIn automation FAILED: publish', String(e.stack || e)).catch(() => {});
      published.push({ id, result: 'error', error: String(e.message || e) });
    }
  }
  return { published };
}
