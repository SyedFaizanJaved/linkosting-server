import jwt from 'jsonwebtoken';

export function requireJwt(req, res, next) {
  const token = req.cookies?.access_token;
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
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
