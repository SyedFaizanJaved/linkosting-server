import { Router } from 'express';
import { authUrl, exchangeCode } from '../linkedin.js';
import { setSetting } from '../db.js';
import { requireJwt } from '../auth.js';
import { ah } from '../util.js';

const router = Router();

router.get('/auth-url', requireJwt, (req, res) => res.json({ url: authUrl() }));

router.get('/callback', ah(async (req, res) => {
  const { code, error, error_description } = req.query;
  if (error) return res.status(400).send(`LinkedIn error: ${error_description || error}`);
  const { token, expiresAt, memberUrn } = await exchangeCode(code);
  await setSetting('linkedin_token', token);
  await setSetting('linkedin_token_expires_at', expiresAt);
  await setSetting('linkedin_member_urn', memberUrn);
  res.send('LinkedIn connected successfully. You can close this tab.');
}));

export default router;
