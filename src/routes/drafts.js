import { Router } from 'express';
import { query, getAllSettings } from '../db/index.js';
import { buildDraftsFilter } from '../db/draftsFilter.js';
import { requireJwt } from '../middleware/auth.js';
import { ah, validateScheduledAt } from '../util.js';
import { publishDraft } from '../jobs/publish.js';
import { generatePost } from '../services/gemini.js';

const SOURCES = new Set(['generated', 'manual']);
const router = Router();
router.use(requireJwt);

router.get('/', ah(async (req, res) => {
  const { where, params } = buildDraftsFilter(req.query);
  const { rows } = await query(
    `SELECT * FROM drafts ${where} ORDER BY created_at DESC LIMIT 200`, params
  );
  res.json(rows);
}));

router.get('/today', ah(async (req, res) => {
  const { rows: [d] } = await query('SELECT * FROM drafts ORDER BY created_at DESC LIMIT 1');
  res.json(d || null);
}));

router.post('/', ah(async (req, res) => {
  const { content, topic = null, source = 'manual' } = req.body || {};
  if (!content || !content.trim()) return res.status(400).json({ error: 'content is required' });
  if (!SOURCES.has(source)) return res.status(400).json({ error: 'invalid source' });
  const { rows: [d] } = await query(
    `INSERT INTO drafts (article_url, article_title, topic, content, source)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [`manual:${Date.now()}`, (content.trim().split('\n')[0] || 'Untitled').slice(0, 120), topic, content.trim(), source]
  );
  res.status(201).json(d);
}));

router.put('/:id', ah(async (req, res) => {
  const { edited_content } = req.body || {};
  if (typeof edited_content !== 'string') {
    return res.status(400).json({ error: 'edited_content is required' });
  }
  const { rows: [d] } = await query(
    "UPDATE drafts SET edited_content=$2 WHERE id=$1 AND status <> 'posted' RETURNING *",
    [req.params.id, edited_content]
  );
  if (!d) return res.status(409).json({ error: 'already posted' });
  res.json(d);
}));

router.post('/:id/approve', ah(async (req, res) => {
  const { rows: [d] } = await query(
    `UPDATE drafts SET status='approved' WHERE id=$1 AND status <> 'posted' RETURNING *`,
    [req.params.id]
  );
  if (!d) return res.status(409).json({ error: 'not found or already posted' });
  res.json(d);
}));

router.put('/:id/schedule', ah(async (req, res) => {
  const { scheduled_at } = req.body || {};
  const err = validateScheduledAt(scheduled_at === undefined ? undefined : scheduled_at);
  if (err) return res.status(400).json({ error: err });
  const { rows: [d] } = await query(
    `UPDATE drafts SET scheduled_at=$2 WHERE id=$1 AND status <> 'posted' RETURNING *`,
    [req.params.id, scheduled_at]
  );
  if (!d) return res.status(409).json({ error: 'not found or already posted' });
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
     WHERE id=$1 RETURNING *`,
    [req.params.id, nums.impressions ?? null, nums.reactions ?? null, nums.comments ?? null]
  );
  if (!d) return res.status(404).json({ error: 'not found' });
  res.json(d);
}));

router.post('/:id/publish', ah(async (req, res) => {
  const { rows: [d] } = await query('SELECT id, status FROM drafts WHERE id=$1', [req.params.id]);
  if (!d) return res.status(404).json({ error: 'not found' });
  if (d.status === 'posted') return res.status(409).json({ error: 'already posted' });
  res.json({ ok: true, ...(await publishDraft(d.id)) });
}));

router.post('/:id/regenerate', ah(async (req, res) => {
  const { rows: [d] } = await query('SELECT * FROM drafts WHERE id=$1', [req.params.id]);
  if (!d) return res.status(404).json({ error: 'not found' });
  if (d.status === 'posted') return res.status(409).json({ error: 'already posted' });
  const s = await getAllSettings();
  const content = await generatePost(
    { title: d.article_title, snippet: d.article_snippet || '', link: d.article_url },
    s
  );
  const { rows: [u] } = await query(
    `UPDATE drafts SET content=$2, edited_content=NULL, status='pending' WHERE id=$1 RETURNING *`,
    [d.id, content]
  );
  res.json(u);
}));

export default router;
