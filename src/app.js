import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import linkedinRoutes from './routes/linkedin.js';

export function buildApp() {
  const app = express();
  app.use(cors({ origin: [process.env.CLIENT_ORIGIN, 'http://localhost:5173'].filter(Boolean) }));
  app.use(express.json());
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);
  app.use('/api/linkedin', linkedinRoutes);
  app.use((err, req, res, next) => res.status(500).json({ error: String(err.message || err) }));
  return app;
}
