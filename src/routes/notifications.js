import { Router } from 'express';
import { query } from '../db/index.js';
import { getUserSettings, updateUserSettings } from '../db/userSettings.js';
import { requireJwt, loadUser, requireActive } from '../middleware/auth.js';
import { ah } from '../util.js';
import { deriveNotifications, parseList } from '../services/notifications.js';

const router = Router();
router.use(requireJwt, loadUser, requireActive);

async function loadNotifications(userId, isAdmin = false) {
  const [{ rows: drafts }, settings, { rows: pendingUsers }] = await Promise.all([
    query(`SELECT id, status, article_title, created_at, posted_at FROM drafts
           WHERE user_id=$1 AND (status='pending' OR (status='posted' AND posted_at > now() - interval '48 hours'))
           ORDER BY created_at DESC LIMIT 50`, [userId]),
    getUserSettings(userId),
    isAdmin
      ? query(`SELECT id, email FROM users WHERE status='pending' ORDER BY created_at DESC LIMIT 20`)
      : { rows: [] },
  ]);
  return { list: deriveNotifications(drafts, settings, new Date(), pendingUsers), settings };
}

router.get('/', ah(async (req, res) => {
  const { list } = await loadNotifications(req.user.sub, req.user.role === 'admin');
  res.json(list);
}));

// Mark every currently-shown notification as read (clears the unread badge).
router.post('/read-all', ah(async (req, res) => {
  const { list, settings } = await loadNotifications(req.user.sub, req.user.role === 'admin');
  const read = new Set([...parseList(settings.notif_read), ...list.map(n => n.id)]);
  await updateUserSettings(req.user.sub, { notif_read: JSON.stringify([...read]) });
  res.json({ ok: true });
}));

// Dismiss a single notification (hidden until its underlying condition changes).
// Ownership is implicit: this only ever reads/writes the caller's own settings
// row, so a guessed foreign id is harmless - it just adds a never-matching id
// to the caller's own dismissed list.
router.delete('/:id', ah(async (req, res) => {
  const settings = await getUserSettings(req.user.sub);
  const dismissed = new Set(parseList(settings.notif_dismissed));
  dismissed.add(req.params.id);
  await updateUserSettings(req.user.sub, { notif_dismissed: JSON.stringify([...dismissed]) });
  res.json({ ok: true });
}));

export default router;
