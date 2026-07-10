import { query, getAllSettings } from '../db/index.js';
import { fetchCandidates, pickFresh } from '../services/articles.js';
import { generatePost } from '../services/gemini.js';
import { sendMail } from '../services/email.js';

export async function runGenerate() {
  const s = await getAllSettings();
  const feeds = JSON.parse(s.feeds || '[]');
  if (!feeds.length) throw new Error('No RSS feeds configured');
  const used = (await query('SELECT article_url FROM drafts')).rows.map(r => r.article_url);
  const article = pickFresh(await fetchCandidates(feeds), used);
  if (!article) throw new Error('No fresh articles found in feeds');
  const content = await generatePost(article, s);
  const { rows: [draft] } = await query(
    `INSERT INTO drafts (article_url, article_title, article_snippet, topic, content, source)
     VALUES ($1,$2,$3,$4,$5,'daily') RETURNING *`,
    [article.link, article.title, article.snippet, s.topics, content]
  );
  await sendMail(
    `[LI-Draft #${draft.id}] Today's LinkedIn post — reply OK to approve`,
    `${content}\n\n---\nReply OK to approve as-is.\nReply with ONLY your edited post text to replace it.\nIgnore this email and nothing will be posted.\n\nDashboard: ${process.env.CLIENT_ORIGIN}\nSource: ${article.link}`
  );
  return draft;
}
