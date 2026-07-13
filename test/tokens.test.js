import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret';

const { signAccess, signRefresh, verifyRefresh } = await import('../src/services/tokens.js');

test('access token verifies with JWT_SECRET and carries sub', () => {
  const p = jwt.verify(signAccess(5), 'test-secret');
  assert.equal(p.sub, 5);
});

test('refresh token verifies for the same user', () => {
  const user = { id: 1, password_hash: 'hashA' };
  assert.equal(verifyRefresh(signRefresh(user), user), true);
});

test('refresh token is invalid after a password change', () => {
  const user = { id: 1, password_hash: 'hashA' };
  const t = signRefresh(user);
  assert.equal(verifyRefresh(t, { ...user, password_hash: 'hashB' }), false);
});

test('refresh token bound to user 1 fails for user 2', () => {
  const t = signRefresh({ id: 1, password_hash: 'hashA' });
  assert.equal(verifyRefresh(t, { id: 2, password_hash: 'hashA' }), false);
});

test('garbage refresh token fails closed', () => {
  assert.equal(verifyRefresh('not.a.token', { id: 1, password_hash: 'hashA' }), false);
});
