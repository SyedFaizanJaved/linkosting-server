import { Router } from 'express';
import { query, getAllSettings } from '../db/index.js';
import { requireJwt } from '../middleware/auth.js';
import { ah } from '../util.js';
import { publishDraft } from '../jobs.js';
import { generatePost } from '../services/gemini.js';

const router = Router();
router.use(requireJwt);

router.get('/', ah(async (req, res) => {
  const { rows } = await query('SELECT * FROM drafts ORDER BY created_at DESC LIMIT 100');
  res.json(rows);
}));

router.get('/today', ah(async (req, res) => {
  const { rows: [d] } = await query('SELECT * FROM drafts ORDER BY created_at DESC LIMIT 1');
  res.json(d || null);
}));

router.put('/:id', ah(async (req, res) => {
  const { rows: [d] } = await query(
    'UPDATE drafts SET edited_content=$2 WHERE id=$1 RETURNING *',
    [req.params.id, req.body?.edited_content ?? null]
  );
  if (!d) return res.status(404).json({ error: 'not found' });
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

router.post('/:id/publish', ah(async (req, res) => {
  const { rows: [d] } = await query('SELECT * FROM drafts WHERE id=$1', [req.params.id]);
  if (!d) return res.status(404).json({ error: 'not found' });
  if (d.status === 'posted') return res.status(409).json({ error: 'already posted' });
  const postId = await publishDraft(d.id, d.edited_content || d.content);
  res.json({ ok: true, postId });
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
