import { Router } from 'express';
import { query, getAllSettings } from '../db/index.js';
import { buildDraftsFilter } from '../db/draftsFilter.js';
import { requireJwt, loadUser, requireActive } from '../middleware/auth.js';
import { ah, validateScheduledAt } from '../util.js';
import { publishDraft } from '../jobs/publish.js';
import { generatePost } from '../services/gemini.js';
import { generateImage } from '../services/image.js';
import { DRAFT_COLS } from '../db/draftCols.js';
import { bumpUsage } from '../db/userSettings.js';

const SOURCES = new Set(['generated', 'manual']);
const router = Router();
router.use(requireJwt, loadUser, requireActive);

router.get('/', ah(async (req, res) => {
  const { where, params } = buildDraftsFilter(req.query);
  const scoped = where ? `${where} AND user_id = $${params.length + 1}` : `WHERE user_id = $${params.length + 1}`;
  const { rows } = await query(
    `SELECT ${DRAFT_COLS} FROM drafts ${scoped} ORDER BY created_at DESC LIMIT 200`, [...params, req.user.sub]
  );
  res.json(rows);
}));

router.get('/today', ah(async (req, res) => {
  const { rows: [d] } = await query(
    `SELECT ${DRAFT_COLS} FROM drafts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [req.user.sub]
  );
  res.json(d || null);
}));

router.post('/', ah(async (req, res) => {
  const { content, topic = null, source = 'manual' } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: 'content is required' });
  if (!SOURCES.has(source)) return res.status(400).json({ error: 'invalid source' });
  const { rows: [d] } = await query(
    `INSERT INTO drafts (user_id, article_url, article_title, topic, content, source)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${DRAFT_COLS}`,
    [req.user.sub, `manual:${Date.now()}`, (content.trim().split('\n')[0] || 'Untitled').slice(0, 120), topic, content.trim(), source]
  );
  res.status(201).json(d);
}));

router.put('/:id', ah(async (req, res) => {
  const { edited_content } = req.body || {};
  if (typeof edited_content !== 'string') {
    return res.status(400).json({ error: 'edited_content is required' });
  }
  const { rows: [d] } = await query(
    `UPDATE drafts SET edited_content=$2 WHERE id=$1 AND user_id=$3 AND status <> 'posted' RETURNING ${DRAFT_COLS}`,
    [req.params.id, edited_content, req.user.sub]
  );
  if (!d) {
    const { rows: [exists] } = await query('SELECT status FROM drafts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]);
    if (!exists) return res.status(404).json({ error: 'not found' });
    return res.status(409).json({ error: 'already posted' });
  }
  res.json(d);
}));

router.post('/:id/approve', ah(async (req, res) => {
  const { rows: [d] } = await query(
    `UPDATE drafts SET status='approved' WHERE id=$1 AND user_id=$2 AND status <> 'posted' RETURNING ${DRAFT_COLS}`,
    [req.params.id, req.user.sub]
  );
  if (!d) {
    const { rows: [exists] } = await query('SELECT status FROM drafts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]);
    if (!exists) return res.status(404).json({ error: 'not found' });
    return res.status(409).json({ error: 'already posted' });
  }
  res.json(d);
}));

router.put('/:id/schedule', ah(async (req, res) => {
  const { scheduled_at } = req.body || {};
  const err = validateScheduledAt(scheduled_at);
  if (err) return res.status(400).json({ error: err });
  const { rows: [d] } = await query(
    `UPDATE drafts SET scheduled_at=$2,
            status = CASE WHEN $2::timestamptz IS NULL AND status='approved' THEN 'pending' ELSE status END
     WHERE id=$1 AND user_id=$3 AND status <> 'posted' RETURNING ${DRAFT_COLS}`,
    [req.params.id, scheduled_at, req.user.sub]
  );
  if (!d) {
    const { rows: [exists] } = await query('SELECT status FROM drafts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]);
    if (!exists) return res.status(404).json({ error: 'not found' });
    return res.status(409).json({ error: 'already posted' });
  }
  res.json(d);
}));

router.put('/:id/metrics', ah(async (req, res) => {
  const nums = {};
  for (const k of ['impressions', 'reactions', 'comments']) {
    const v = req.body?.[k];
    if (v !== undefined) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) return res.status(400).json({ error: `${k} must be a non-negative integer` });
      nums[k] = n;
    }
  }
  const { rows: [d] } = await query(
    `UPDATE drafts SET
       impressions = COALESCE($2, impressions),
       reactions   = COALESCE($3, reactions),
       comments    = COALESCE($4, comments)
     WHERE id=$1 AND user_id=$5 RETURNING ${DRAFT_COLS}`,
    [req.params.id, nums.impressions ?? null, nums.reactions ?? null, nums.comments ?? null, req.user.sub]
  );
  if (!d) return res.status(404).json({ error: 'not found' });
  res.json(d);
}));

router.post('/:id/publish', ah(async (req, res) => {
  const { rows: [d] } = await query('SELECT id, status FROM drafts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]);
  if (!d) return res.status(404).json({ error: 'not found' });
  if (d.status === 'posted') return res.status(409).json({ error: 'already posted' });
  res.json({ ok: true, ...(await publishDraft(d.id, undefined, {}, req.user.sub)) });
}));

router.post('/:id/regenerate', ah(async (req, res) => {
  const { rows: [d] } = await query('SELECT * FROM drafts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]);
  if (!d) return res.status(404).json({ error: 'not found' });
  if (d.status === 'posted') return res.status(409).json({ error: 'already posted' });
  const s = await getAllSettings();
  const content = await generatePost(
    { title: d.article_title, snippet: d.article_snippet || '', link: d.article_url },
    s
  );
  const { rows: [u] } = await query(
    `UPDATE drafts SET content=$2, edited_content=NULL, status='pending' WHERE id=$1 AND user_id=$3 RETURNING ${DRAFT_COLS}`,
    [d.id, content, req.user.sub]
  );
  res.json(u);
}));

router.post('/:id/image', ah(async (req, res) => {
  const { rows: [d] } = await query(
    'SELECT id, status, content, edited_content FROM drafts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]
  );
  if (!d) return res.status(404).json({ error: 'not found' });
  if (d.status === 'posted') return res.status(409).json({ error: 'already posted' });
  if (req.user.role !== 'admin' && !(await bumpUsage(req.user.sub, 'image'))) {
    return res.status(429).json({ error: 'Daily generation limit reached — try again tomorrow.' });
  }
  const s = await getAllSettings();
  const { bytes, mime } = await generateImage(d.edited_content || d.content, s);
  await query(
    `UPDATE drafts SET image=$2, image_mime=$3 WHERE id=$1 AND user_id=$4 AND status <> 'posted'`,
    [d.id, bytes, mime, req.user.sub]
  );
  res.json({ ok: true, hasImage: true });
}));

router.delete('/:id/image', ah(async (req, res) => {
  const { rows: [d] } = await query(
    `UPDATE drafts SET image=NULL, image_mime=NULL WHERE id=$1 AND user_id=$2 AND status <> 'posted' RETURNING id`,
    [req.params.id, req.user.sub]
  );
  if (!d) {
    const { rows: [exists] } = await query('SELECT status FROM drafts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]);
    if (!exists) return res.status(404).json({ error: 'not found' });
    return res.status(409).json({ error: 'already posted' });
  }
  res.json({ ok: true, hasImage: false });
}));

router.get('/:id/image', ah(async (req, res) => {
  const { rows: [d] } = await query(
    'SELECT image, image_mime FROM drafts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]
  );
  if (!d || !d.image) return res.status(404).json({ error: 'no image' });
  res.type(d.image_mime || 'image/png').send(d.image);
}));

// Discard a draft (used by the AI Generator's Discard action and the Library).
// Posted drafts are live on LinkedIn and cannot be discarded.
router.delete('/:id', ah(async (req, res) => {
  const { rows: [d] } = await query(
    `DELETE FROM drafts WHERE id=$1 AND user_id=$2 AND status <> 'posted' RETURNING id`,
    [req.params.id, req.user.sub]
  );
  if (!d) {
    const { rows: [exists] } = await query('SELECT status FROM drafts WHERE id=$1 AND user_id=$2', [req.params.id, req.user.sub]);
    if (exists) return res.status(409).json({ error: 'cannot discard a posted draft' });
    return res.status(404).json({ error: 'not found' });
  }
  res.json({ ok: true });
}));

export default router;
