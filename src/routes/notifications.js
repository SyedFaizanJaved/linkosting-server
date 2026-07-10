import { Router } from 'express';
import { query, getAllSettings } from '../db/index.js';
import { requireJwt } from '../middleware/auth.js';
import { ah } from '../util.js';
import { deriveNotifications } from '../services/notifications.js';

const router = Router();
router.use(requireJwt);

router.get('/', ah(async (req, res) => {
  const [{ rows: drafts }, settings] = await Promise.all([
    query(`SELECT id, status, article_title, created_at, posted_at FROM drafts
           WHERE status='pending' OR (status='posted' AND posted_at > now() - interval '48 hours')
           ORDER BY created_at DESC LIMIT 50`),
    getAllSettings(),
  ]);
  res.json(deriveNotifications(drafts, settings));
}));

export default router;
