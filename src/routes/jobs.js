import { Router } from 'express';
import { requireCronSecret } from '../middleware/auth.js';
import { ah } from '../util.js';
import { runGenerate } from '../jobs/generate.js';
import { runPublish } from '../jobs/publish.js';
import { sendMail } from '../services/email.js';

const router = Router();

router.post('/generate', requireCronSecret, ah(async (req, res) => {
  try {
    const draft = await runGenerate();
    res.json({ ok: true, draftId: draft.id });
  } catch (e) {
    await sendMail('LinkedIn automation FAILED: generate', String(e.stack || e)).catch(() => {});
    throw e;
  }
}));

router.post('/publish', requireCronSecret, ah(async (req, res) => {
  res.json(await runPublish({ dryRun: req.body?.dryRun === true || req.body?.dryRun === 'true' }));
}));

export default router;
