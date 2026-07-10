import { Router } from 'express';
import { setSetting, getAllSettings } from '../db/index.js';
import { requireJwt } from '../middleware/auth.js';
import { ah } from '../util.js';

const router = Router();
router.use(requireJwt);

router.get('/', ah(async (req, res) => {
  const s = await getAllSettings();
  let daysLeft = null;
  if (s.linkedin_token_expires_at) {
    daysLeft = Math.floor((new Date(s.linkedin_token_expires_at) - Date.now()) / 86400000);
  }
  res.json({
    topics: s.topics || '',
    tone: s.tone || '',
    hashtags: s.hashtags || '',
    feeds: JSON.parse(s.feeds || '[]'),
    default_post_time: s.default_post_time || '12:00',
    onboarded: s.onboarded || '',
    linkedin: { connected: !!s.linkedin_token, daysLeft },
  });
}));

router.put('/', ah(async (req, res) => {
  const { topics, tone, hashtags, feeds, default_post_time, onboarded } = req.body || {};
  if (default_post_time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(default_post_time)) {
    return res.status(400).json({ error: 'default_post_time must be HH:MM (UTC)' });
  }
  if (topics !== undefined) await setSetting('topics', topics);
  if (tone !== undefined) await setSetting('tone', tone);
  if (hashtags !== undefined) await setSetting('hashtags', hashtags);
  if (feeds !== undefined) await setSetting('feeds', JSON.stringify(feeds));
  if (default_post_time !== undefined) await setSetting('default_post_time', default_post_time);
  if (onboarded !== undefined) await setSetting('onboarded', String(onboarded));
  res.json({ ok: true });
}));

export default router;
