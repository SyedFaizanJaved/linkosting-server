import { Router } from 'express';
import { query, getAllSettings, setSetting } from '../db/index.js';
import { requireJwt } from '../middleware/auth.js';
import { ah } from '../util.js';
import { deriveNotifications, parseList } from '../services/notifications.js';

const router = Router();
router.use(requireJwt);

async function loadNotifications() {
  const [{ rows: drafts }, settings] = await Promise.all([
    query(`SELECT id, status, article_title, created_at, posted_at FROM drafts
           WHERE status='pending' OR (status='posted' AND posted_at > now() - interval '48 hours')
           ORDER BY created_at DESC LIMIT 50`),
    getAllSettings(),
  ]);
  return { list: deriveNotifications(drafts, settings), settings };
}

router.get('/', ah(async (req, res) => {
  const { list } = await loadNotifications();
  res.json(list);
}));

// Mark every currently-shown notification as read (clears the unread badge).
router.post('/read-all', ah(async (req, res) => {
  const { list, settings } = await loadNotifications();
  const read = new Set([...parseList(settings.notif_read), ...list.map(n => n.id)]);
  await setSetting('notif_read', JSON.stringify([...read]));
  res.json({ ok: true });
}));

// Dismiss a single notification (hidden until its underlying condition changes).
router.delete('/:id', ah(async (req, res) => {
  const settings = await getAllSettings();
  const dismissed = new Set(parseList(settings.notif_dismissed));
  dismissed.add(req.params.id);
  await setSetting('notif_dismissed', JSON.stringify([...dismissed]));
  res.json({ ok: true });
}));

export default router;
