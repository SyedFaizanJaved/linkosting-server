import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';
import { ah } from '../util.js';

const router = Router();

router.post('/login', ah(async (req, res) => {
  const { email, password } = req.body || {};
  const { rows: [user] } = await query('SELECT * FROM users WHERE email=$1', [email]);
  if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  res.json({ token: jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' }) });
}));

export default router;
