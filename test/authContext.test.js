import test from 'node:test';
import assert from 'node:assert';
import { requireActive } from '../src/middleware/auth.js';

function mockRes() {
  return { code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
}

test('requireActive passes an active user', () => {
  let called = false;
  requireActive({ user: { status: 'active' } }, mockRes(), () => { called = true; });
  assert.ok(called);
});

test('requireActive blocks a pending user with 403', () => {
  const res = mockRes();
  requireActive({ user: { status: 'pending' } }, res, () => assert.fail('next called'));
  assert.equal(res.code, 403);
  assert.equal(res.body.error, 'account not active');
});

test('requireActive blocks a deactivated user with 403', () => {
  const res = mockRes();
  requireActive({ user: { status: 'deactivated' } }, res, () => assert.fail('next called'));
  assert.equal(res.code, 403);
});

test('requireActive 401s when no user is loaded', () => {
  const res = mockRes();
  requireActive({}, res, () => assert.fail('next called'));
  assert.equal(res.code, 401);
});
