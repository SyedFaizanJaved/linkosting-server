import { Router } from 'express';
import crypto from 'node:crypto';
import { authUrl, exchangeCode } from '../services/linkedin.js';
import { setSetting, getSetting } from '../db/index.js';
import { requireJwt } from '../middleware/auth.js';
import { ah } from '../util.js';

const router = Router();

router.get('/auth-url', requireJwt, ah(async (req, res) => {
  const state = crypto.randomUUID();
  await setSetting('linkedin_oauth_state', state);
  res.json({ url: authUrl(state) });
}));

router.get('/callback', ah(async (req, res) => {
  const { code, state, error, error_description } = req.query;
  if (error) return res.status(400).send(`LinkedIn error: ${error_description || error}`);
  if (!code) return res.status(400).send('Missing code');
  const expected = await getSetting('linkedin_oauth_state');
  if (!expected || state !== expected) return res.status(403).send('Invalid state');
  await setSetting('linkedin_oauth_state', '');
  const { token, expiresAt, memberUrn } = await exchangeCode(code);
  await setSetting('linkedin_token', token);
  await setSetting('linkedin_token_expires_at', expiresAt);
  await setSetting('linkedin_member_urn', memberUrn);
  res.send('LinkedIn connected successfully. You can close this tab.');
}));

export default router;
