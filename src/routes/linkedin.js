import { Router } from 'express';
import crypto from 'node:crypto';
import { authUrl, exchangeCode } from '../services/linkedin.js';
import { getUserSettings, updateUserSettings } from '../db/userSettings.js';
import { requireJwt, loadUser, requireActive } from '../middleware/auth.js';
import { publicLimiter } from '../middleware/rateLimit.js';
import { ah } from '../util.js';

const router = Router();

router.get('/auth-url', requireJwt, loadUser, requireActive, ah(async (req, res) => {
  const from = req.query.from === 'onboarding' ? 'o' : 's';
  const state = `${crypto.randomUUID()}:${from}:${req.user.sub}`;
  await updateUserSettings(req.user.sub, { linkedin_oauth_state: state });
  res.json({ url: authUrl(state) });
}));

// Public callback (LinkedIn redirects here with no cookie), so the user is
// recovered from the state string itself: `${uuid}:${from}:${userId}`.
router.get('/callback', publicLimiter, ah(async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const [, from, uidStr] = String(state || '').split(':');
  const returnPath = from === 'o' ? '/onboarding' : '/settings';
  const back = params =>
    res.redirect(`${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}${returnPath}?${new URLSearchParams(params)}`);

  if (error) return back({ linkedin: 'error', reason: error_description || error });
  if (!code) return back({ linkedin: 'error', reason: 'Missing code' });

  const userId = Number(uidStr);
  if (!userId) return back({ linkedin: 'error', reason: 'Invalid state - start the connection again' });
  const s = await getUserSettings(userId);
  if (!s.linkedin_oauth_state || state !== s.linkedin_oauth_state) {
    return back({ linkedin: 'error', reason: 'Invalid state - start the connection again' });
  }
  // ponytail: invalidate the state before exchanging (not only on success) so
  // it stays single-use even if the exchange fails and the callback is retried.
  await updateUserSettings(userId, { linkedin_oauth_state: null });
  try {
    const { token, expiresAt, memberUrn } = await exchangeCode(code);
    await updateUserSettings(userId, {
      linkedin_token: token,
      linkedin_token_expires_at: expiresAt,
      linkedin_member_urn: memberUrn,
      linkedin_oauth_state: null,
    });
  } catch {
    return back({ linkedin: 'error', reason: 'LinkedIn rejected the connection - try again' });
  }
  return back({ linkedin: 'connected' });
}));

export default router;
