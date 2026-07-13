import { Router } from 'express';
import { requireJwt, loadUser, requireActive } from '../middleware/auth.js';
import { ah } from '../util.js';
import { getUserSettings, bumpUsage } from '../db/userSettings.js';
import { generateVariants } from '../services/gemini.js';

const router = Router();

router.post('/', requireJwt, loadUser, requireActive, ah(async (req, res) => {
  const { prompt, tone = 'professional', length = 'medium' } = req.body || {};
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt is required' });
  if (req.user.role !== 'admin' && !(await bumpUsage(req.user.sub, 'text'))) {
    return res.status(429).json({ error: 'Daily generation limit reached — try again tomorrow.' });
  }
  const settings = await getUserSettings(req.user.sub);
  const variants = await generateVariants({ prompt: prompt.trim(), tone, length }, settings);
  res.json({ variants });
}));

export default router;
