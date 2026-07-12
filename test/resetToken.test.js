import test from 'node:test';
import assert from 'node:assert';

process.env.JWT_SECRET = 'test-secret';

const { buildResetToken, verifyResetToken } = await import('../src/services/resetToken.js');

const user = { id: 1, password_hash: 'hashA' };

test('a freshly built token verifies for the same user', () => {
  assert.equal(verifyResetToken(buildResetToken(user), user), true);
});

test('token is invalid once the password hash changes', () => {
  const t = buildResetToken(user);
  assert.equal(verifyResetToken(t, { ...user, password_hash: 'hashB' }), false);
});

test('garbage/tampered token fails closed', () => {
  assert.equal(verifyResetToken('not.a.token', user), false);
});

test('token bound to user 1 does not verify for user 2', () => {
  const t = buildResetToken(user);
  assert.equal(verifyResetToken(t, { id: 2, password_hash: 'hashA' }), false);
});
