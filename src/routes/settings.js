import { Router } from 'express';
import { getUserSettings, updateUserSettings } from '../db/userSettings.js';
import { requireJwt, loadUser, requireActive } from '../middleware/auth.js';
import { ah } from '../util.js';

const router = Router();
router.use(requireJwt, loadUser, requireActive);

router.get('/', ah(async (req, res) => {
  const s = await getUserSettings(req.user.sub);
  let daysLeft = null;
  if (s.linkedin_token_expires_at) daysLeft = Math.floor((new Date(s.linkedin_token_expires_at) - Date.now()) / 86400000);
  res.json({
    topics: s.topics || '', tone: s.tone || '', hashtags: s.hashtags || '',
    feeds: JSON.parse(s.feeds || '[]'),
    default_post_time: s.default_post_time || '12:00',
    onboarded: s.onboarded ? 'true' : '',
    daily_draft_enabled: !!s.daily_draft_enabled,
    linkedin: {
      connected: !!s.linkedin_token && (daysLeft === null || daysLeft >= 0),
      expired: !!s.linkedin_token && daysLeft !== null && daysLeft < 0,
      daysLeft,
    },
  });
}));

router.put('/', ah(async (req, res) => {
  const { topics, tone, hashtags, feeds, default_post_time, onboarded, daily_draft_enabled } = req.body || {};
  if (default_post_time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(default_post_time)) {
    return res.status(400).json({ error: 'default_post_time must be HH:MM (UTC)' });
  }
  const patch = {};
  if (topics !== undefined) patch.topics = topics;
  if (tone !== undefined) patch.tone = tone;
  if (hashtags !== undefined) patch.hashtags = hashtags;
  if (feeds !== undefined) patch.feeds = JSON.stringify(feeds);
  if (default_post_time !== undefined) patch.default_post_time = default_post_time;
  if (onboarded !== undefined) patch.onboarded = onboarded === true || onboarded === 'true';
  if (daily_draft_enabled !== undefined) patch.daily_draft_enabled = !!daily_draft_enabled;
  await updateUserSettings(req.user.sub, patch);
  res.json({ ok: true });
}));

export default router;
