import jwt from 'jsonwebtoken';

export function requireJwt(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
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
