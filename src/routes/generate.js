import { Router } from 'express';
import { requireJwt, loadUser, requireActive } from '../middleware/auth.js';
import { ah, isStr } from '../util.js';
import { getUserSettings, bumpUsage } from '../db/userSettings.js';
import { generateVariants } from '../services/gemini.js';

const TONES = new Set(['professional', 'friendly', 'bold', 'analytical']);
const LENGTHS = new Set(['short', 'medium', 'long']);

const router = Router();

router.post('/', requireJwt, loadUser, requireActive, ah(async (req, res) => {
  const { prompt, tone = 'professional', length = 'medium' } = req.body || {};
  if (!isStr(prompt, 2000) || !prompt.trim()) return res.status(400).json({ error: 'prompt is required (max 2000 chars)' });
  if (!TONES.has(tone) || !LENGTHS.has(length)) return res.status(400).json({ error: 'invalid tone or length' });
  if (req.user.role !== 'admin' && !(await bumpUsage(req.user.sub, 'text'))) {
    return res.status(429).json({ error: 'Daily generation limit reached — try again tomorrow.' });
  }
  const settings = await getUserSettings(req.user.sub);
  const variants = await generateVariants({ prompt: prompt.trim(), tone, length }, settings);
  res.json({ variants });
}));

export default router;
