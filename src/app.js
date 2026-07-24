import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { requireCsrfHeader } from './middleware/auth.js';
import { apiLimiter } from './middleware/rateLimit.js';
import authRoutes from './routes/auth.js';
import linkedinRoutes from './routes/linkedin.js';
import jobRoutes from './routes/jobs.js';
import draftRoutes from './routes/drafts.js';
import settingsRoutes from './routes/settings.js';
import generateRoutes from './routes/generate.js';
import analyticsRoutes from './routes/analytics.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';

export function errorHandler(err, req, res, next) {
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    return res.status(400).json({ error: 'invalid request body' });
  }
  // Full detail server-side only; the client gets nothing internal.
  console.error(`[${req.method} ${req.path}]`, err?.stack || err);
  res.status(500).json({ error: 'internal server error' });
}

export function buildApp() {
  const app = express();
  // Render terminates TLS at a proxy; without this req.ip is the proxy, and
  // every client would share one rate-limit bucket.
  app.set('trust proxy', 1);
  app.use((req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });
  app.use(cors({ origin: [process.env.CLIENT_ORIGIN, 'http://localhost:5173'].filter(Boolean), credentials: true }));
  app.use(express.json({ limit: '50kb' })); // largest legit payload (settings w/ 20 feeds) is well under this
  app.use(cookieParser());
  app.use(requireCsrfHeader);
  // Loose global limiter; /api/jobs (server-to-server cron, secret-guarded) is exempt.
  app.use((req, res, next) => (req.path.startsWith('/api/jobs') ? next() : apiLimiter(req, res, next)));
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/linkedin', linkedinRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/drafts', draftRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/generate', generateRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);
  app.use(errorHandler);
  return app;
}
