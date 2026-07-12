import jwt from 'jsonwebtoken';

// Sign reset tokens with a secret derived from the user's CURRENT password hash,
// so changing the password automatically invalidates any outstanding reset link.
const resetSecret = passwordHash => `${process.env.JWT_SECRET}:${passwordHash}`;

export function buildResetToken(user) {
  return jwt.sign({ sub: user.id, kind: 'reset' }, resetSecret(user.password_hash), { expiresIn: '1h' });
}

export function verifyResetToken(token, user) {
  try {
    const payload = jwt.verify(token, resetSecret(user.password_hash));
    return payload.kind === 'reset' && String(payload.sub) === String(user.id);
  } catch {
    return false;
  }
}
