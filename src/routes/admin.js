import { Router } from 'express';
import { query } from '../db/index.js';
import { requireJwt, loadUser, requireActive, requireAdmin } from '../middleware/auth.js';
import { ah } from '../util.js';

const router = Router();
router.use(requireJwt, loadUser, requireActive, requireAdmin);

export const USER_STATUSES = ['pending', 'active', 'deactivated'];

// ponytail: one status endpoint covers approve / deactivate / re-pend.
// Separate /approve and /deactivate routes would be the same handler twice.
router.get('/users', ah(async (_req, res) => {
  const { rows } = await query(
    `SELECT id, email, role, status, created_at FROM users
     ORDER BY (status='pending') DESC, created_at DESC`
  );
  res.json(rows);
}));

router.put('/users/:id/status', ah(async (req, res) => {
  const { status } = req.body || {};
  if (!USER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${USER_STATUSES.join(', ')}` });
  }
  // Self-lockout guard: the last admin demoting themselves leaves nobody able
  // to approve anyone, recoverable only by hand-editing the database.
  if (String(req.params.id) === String(req.user.id) && status !== 'active') {
    return res.status(400).json({ error: 'you cannot deactivate your own admin account' });
  }
  const { rows: [u] } = await query(
    `UPDATE users SET status=$1 WHERE id=$2 RETURNING id, email, role, status`,
    [status, req.params.id]
  );
  if (!u) return res.status(404).json({ error: 'not found' });
  res.json(u);
}));

export default router;
