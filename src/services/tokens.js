import jwt from 'jsonwebtoken';

const ACCESS_MS = 15 * 60 * 1000;          // 15 minutes
const REFRESH_MS = 7 * 24 * 3600 * 1000;   // 7 days

// Refresh tokens are signed with a secret bound to the user's current password
// hash, so changing the password revokes every outstanding refresh token.
const refreshSecret = passwordHash => `${process.env.JWT_SECRET}:refresh:${passwordHash}`;

export const signAccess = userId => jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
export const signRefresh = user => jwt.sign({ sub: user.id }, refreshSecret(user.password_hash), { expiresIn: '7d' });

export function verifyRefresh(token, user) {
  try {
    const p = jwt.verify(token, refreshSecret(user.password_hash));
    return String(p.sub) === String(user.id);
  } catch {
    return false;
  }
}

// Cross-site (client and API on different domains in prod) needs SameSite=None+Secure;
// local http dev needs SameSite=Lax and Secure off. Derive from SERVER_URL.
function base() {
  const secure = (process.env.SERVER_URL || '').startsWith('https');
  return { httpOnly: true, secure, sameSite: secure ? 'none' : 'lax', path: '/' };
}

export function setAuthCookies(res, user) {
  res.cookie('access_token', signAccess(user.id), { ...base(), maxAge: ACCESS_MS });
  res.cookie('refresh_token', signRefresh(user), { ...base(), maxAge: REFRESH_MS });
}

export function clearAuthCookies(res) {
  res.clearCookie('access_token', base());
  res.clearCookie('refresh_token', base());
}
