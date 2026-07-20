import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

export function requireJwt(req, res, next) {
  const token = req.cookies?.access_token;
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

// Loads role/status/id onto req.user (which already has .sub from requireJwt).
export async function loadUser(req, res, next) {
  try {
    const { rows: [u] } = await query('SELECT id, email, role, status FROM users WHERE id=$1', [req.user?.sub]);
    if (!u) return res.status(401).json({ error: 'unauthorized' });
    req.user = { ...req.user, id: u.id, email: u.email, role: u.role, status: u.status };
    next();
  } catch (e) { next(e); }
}

export function requireActive(req, res, next) {
  if (!req.user?.status) return res.status(401).json({ error: 'unauthorized' });
  if (req.user.status !== 'active') return res.status(403).json({ error: 'account not active' });
  next();
}

// 404, not 403: a non-admin should not learn the admin surface exists.
export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(404).json({ error: 'not found' });
  next();
}

export function requireCronSecret(req, res, next) {
  if (process.env.CRON_SECRET && req.headers['x-cron-secret'] === process.env.CRON_SECRET) return next();
  res.status(401).json({ error: 'unauthorized' });
}

// CSRF guard for cookie auth: state-changing requests must carry a custom
// header, which browsers can't add cross-site without a preflight that our
// CORS origin allowlist then blocks. Cron job endpoints (secret-protected,
// called server-to-server) are exempt.
export function requireCsrfHeader(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.path?.startsWith('/api/jobs')) return next();
  if (req.headers['x-requested-with']) return next();
  res.status(403).json({ error: 'missing X-Requested-With header' });
}
