import { Router } from 'express';
import { requireJwt } from '../middleware/auth.js';
import { ah } from '../util.js';
import { getAllSettings } from '../db/index.js';
import { generateVariants } from '../services/gemini.js';

const router = Router();

router.post('/', requireJwt, ah(async (req, res) => {
  const { prompt, tone = 'professional', length = 'medium' } = req.body || {};
  if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt is required' });
  const settings = await getAllSettings();
  const variants = await generateVariants({ prompt: prompt.trim(), tone, length }, settings);
  res.json({ variants });
}));

export default router;
