import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';
import { ah } from '../util.js';
import { buildResetToken, verifyResetToken } from '../services/resetToken.js';
import { sendMail } from '../services/email.js';

const router = Router();

router.post('/login', ah(async (req, res) => {
  const { email, password } = req.body || {};
  const { rows: [user] } = await query('SELECT * FROM users WHERE email=$1', [email]);
  if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  res.json({ token: jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' }) });
}));

router.get('/status', ah(async (req, res) => {
  const { rows: [{ count }] } = await query('SELECT count(*)::int AS count FROM users');
  res.json({ registered: count > 0 });
}));

router.post('/register', ah(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
  const { rows: [{ count }] } = await query('SELECT count(*)::int AS count FROM users');
  if (count > 0) return res.status(409).json({ error: 'an account already exists' });
  const hash = bcrypt.hashSync(password, 10);
  const { rows: [user] } = await query(
    'INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING *', [email, hash]
  );
  res.status(201).json({ token: jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' }) });
}));

router.post('/forgot', ah(async (req, res) => {
  const { email } = req.body || {};
  const { rows: [user] } = await query('SELECT * FROM users WHERE email=$1', [email || '']);
  if (user) {
    const token = buildResetToken(user);
    const link = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/reset?token=${token}`;
    const body = `Reset your Linkosting password:\n\n${link}\n\nThis link expires in 1 hour. If you didn't request it, ignore this email.`;
    if (process.env.EMAIL_APP_PASSWORD) {
      await sendMail('Reset your Linkosting password', body, user.email).catch(e => console.error('reset email failed:', e.message));
    } else {
      console.log(`[dev] password reset link for ${user.email}: ${link}`);
    }
  }
  // Always 200 — never reveal whether an account exists for this email.
  res.json({ ok: true });
}));

router.post('/reset', ah(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'token and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });
  let decoded = null;
  try { decoded = jwt.decode(token); } catch { decoded = null; }
  if (!decoded?.sub) return res.status(400).json({ error: 'invalid or expired token' });
  const { rows: [user] } = await query('SELECT * FROM users WHERE id=$1', [decoded.sub]);
  if (!user || !verifyResetToken(token, user)) return res.status(400).json({ error: 'invalid or expired token' });
  const hash = bcrypt.hashSync(password, 10);
  await query('UPDATE users SET password_hash=$2 WHERE id=$1', [user.id, hash]);
  res.json({ ok: true });
}));

export default router;
