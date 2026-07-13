import { Router } from 'express';
import { query, getAllSettings, setSetting } from '../db/index.js';
import { getUserSettings } from '../db/userSettings.js';
import { requireJwt, loadUser, requireActive } from '../middleware/auth.js';
import { ah } from '../util.js';
import { deriveNotifications, parseList } from '../services/notifications.js';

const router = Router();
router.use(requireJwt, loadUser, requireActive);

async function loadNotifications(userId) {
  const [{ rows: drafts }, userSettings, globalSettings] = await Promise.all([
    query(`SELECT id, status, article_title, created_at, posted_at FROM drafts
           WHERE user_id=$1 AND (status='pending' OR (status='posted' AND posted_at > now() - interval '48 hours'))
           ORDER BY created_at DESC LIMIT 50`, [userId]),
    getUserSettings(userId),
    getAllSettings(),
  ]);
  // ponytail: notif_read/notif_dismissed have no column on user_settings yet
  // (schema gap, out of this task's file scope) so they still live in the
  // global key/value settings table - shared across users until a follow-up
  // task adds per-user columns. linkedin token-expiry comes from userSettings.
  const settings = { ...userSettings, notif_read: globalSettings.notif_read, notif_dismissed: globalSettings.notif_dismissed };
  return { list: deriveNotifications(drafts, settings), settings };
}

router.get('/', ah(async (req, res) => {
  const { list } = await loadNotifications(req.user.sub);
  res.json(list);
}));

// Mark every currently-shown notification as read (clears the unread badge).
router.post('/read-all', ah(async (req, res) => {
  const { list, settings } = await loadNotifications(req.user.sub);
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
