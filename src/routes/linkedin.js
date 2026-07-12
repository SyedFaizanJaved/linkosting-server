import { Router } from 'express';
import crypto from 'node:crypto';
import { authUrl, exchangeCode } from '../services/linkedin.js';
import { setSetting, getSetting } from '../db/index.js';
import { requireJwt } from '../middleware/auth.js';
import { ah } from '../util.js';

const router = Router();

router.get('/auth-url', requireJwt, ah(async (req, res) => {
  const from = req.query.from === 'onboarding' ? 'o' : 's';
  const state = `${crypto.randomUUID()}:${from}`;
  await setSetting('linkedin_oauth_state', state);
  res.json({ url: authUrl(state) });
}));

router.get('/callback', ah(async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const returnPath = String(state || '').endsWith(':o') ? '/onboarding' : '/settings';
  const back = params =>
    res.redirect(`${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}${returnPath}?${new URLSearchParams(params)}`);

  if (error) return back({ linkedin: 'error', reason: error_description || error });
  if (!code) return back({ linkedin: 'error', reason: 'Missing code' });
  const expected = await getSetting('linkedin_oauth_state');
  if (!expected || state !== expected) {
    return back({ linkedin: 'error', reason: 'Invalid state - start the connection again' });
  }
  await setSetting('linkedin_oauth_state', '');
  try {
    const { token, expiresAt, memberUrn } = await exchangeCode(code);
    await setSetting('linkedin_token', token);
    await setSetting('linkedin_token_expires_at', expiresAt);
    await setSetting('linkedin_member_urn', memberUrn);
  } catch {
    return back({ linkedin: 'error', reason: 'LinkedIn rejected the connection - try again' });
  }
  return back({ linkedin: 'connected' });
}));

export default router;
