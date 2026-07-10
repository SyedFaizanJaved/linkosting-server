import { query, getAllSettings } from './db/index.js';
import { fetchCandidates, pickFresh } from './services/articles.js';
import { generatePost } from './services/gemini.js';
import { sendMail, fetchApprovalReply } from './services/email.js';
import { parseReply } from './services/replyParser.js';
import { createPost } from './services/linkedin.js';

export function decideApproval(draft, replyText) {
  if (draft.status === 'approved') {
    return { approved: true, text: draft.edited_content || draft.content };
  }
  const parsed = parseReply(replyText);
  if (parsed.action === 'approve') return { approved: true, text: draft.edited_content || draft.content };
  if (parsed.action === 'edit') return { approved: true, text: parsed.text };
  return { approved: false };
}

export async function runGenerate() {
  const s = await getAllSettings();
  const feeds = JSON.parse(s.feeds || '[]');
  if (!feeds.length) throw new Error('No RSS feeds configured');
  const used = (await query('SELECT article_url FROM drafts')).rows.map(r => r.article_url);
  const article = pickFresh(await fetchCandidates(feeds), used);
  if (!article) throw new Error('No fresh articles found in feeds');
  const content = await generatePost(article, s);
  const { rows: [draft] } = await query(
    `INSERT INTO drafts (article_url, article_title, article_snippet, topic, content)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [article.link, article.title, article.snippet, s.topics, content]
  );
  await sendMail(
    `[LI-Draft #${draft.id}] Today's LinkedIn post — reply OK to approve`,
    `${content}\n\n---\nReply OK to approve as-is.\nReply with ONLY your edited post text to replace it.\nIgnore this email and nothing will be posted.\n\nDashboard: ${process.env.CLIENT_ORIGIN}\nSource: ${article.link}`
  );
  return draft;
}

export async function publishDraft(draftId, text) {
  const s = await getAllSettings();
  if (!s.linkedin_token || !s.linkedin_member_urn) {
    throw new Error('LinkedIn not connected — open dashboard Settings and click Connect LinkedIn.');
  }
  const { rows: [claimed] } = await query(
    `UPDATE drafts SET status='posted', edited_content=$2, posted_at=now() WHERE id=$1 AND status <> 'posted' RETURNING id`,
    [draftId, text]
  );
  if (!claimed) throw new Error(`Draft ${draftId} already posted`);
  let postId;
  try {
    postId = await createPost(text, s.linkedin_token, s.linkedin_member_urn);
  } catch (e) {
    await query(`UPDATE drafts SET status='approved', posted_at=NULL WHERE id=$1`, [draftId]).catch(() => {});
    throw e;
  }
  await query(`UPDATE drafts SET linkedin_post_id=$2 WHERE id=$1`, [draftId, postId]);
  await sendMail('Posted to LinkedIn ✔', `${text}\n\nhttps://www.linkedin.com/feed/update/${postId}/`).catch(() => {});
  return postId;
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
  const { rows: [draft] } = await query(
    `SELECT * FROM drafts WHERE status IN ('pending','approved') ORDER BY created_at DESC LIMIT 1`
  );
  if (!draft) return { result: 'no-draft' };

  let replyText = null;
  if (draft.status !== 'approved') replyText = await fetchApprovalReply(draft.id);
  const decision = decideApproval(draft, replyText);

  if (!decision.approved) {
    await query(`UPDATE drafts SET status='skipped' WHERE id=$1`, [draft.id]);
    return { result: 'skipped', draftId: draft.id };
  }
  if (dryRun) return { result: 'dry-run', draftId: draft.id, text: decision.text };
  const postId = await publishDraft(draft.id, decision.text);
  return { result: 'posted', draftId: draft.id, postId };
}
