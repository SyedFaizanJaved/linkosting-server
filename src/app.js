import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import linkedinRoutes from './routes/linkedin.js';
import jobRoutes from './routes/jobs.js';
import draftRoutes from './routes/drafts.js';
import settingsRoutes from './routes/settings.js';
import generateRoutes from './routes/generate.js';
import analyticsRoutes from './routes/analytics.js';
import notificationRoutes from './routes/notifications.js';

export function buildApp() {
  const app = express();
  app.use(cors({ origin: [process.env.CLIENT_ORIGIN, 'http://localhost:5173'].filter(Boolean), credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/linkedin', linkedinRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/drafts', draftRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/generate', generateRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use((err, req, res, next) => res.status(500).json({ error: String(err.message || err) }));
  return app;
}
