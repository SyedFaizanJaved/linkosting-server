import test from 'node:test';
import assert from 'node:assert';
import { requireAdmin } from '../src/middleware/auth.js';
import { USER_STATUSES } from '../src/routes/admin.js';

function mockRes() {
  return { code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
}

test('requireAdmin passes an admin', () => {
  let called = false;
  requireAdmin({ user: { role: 'admin' } }, mockRes(), () => { called = true; });
  assert.ok(called);
});

test('requireAdmin hides the surface from members and anonymous callers', () => {
  for (const user of [{ role: 'member' }, {}, undefined]) {
    const res = mockRes();
    requireAdmin({ user }, res, () => assert.fail('next called'));
    assert.equal(res.code, 404, 'must 404, not 403 — never reveal the admin surface');
  }
});

test('only the three real statuses are accepted', () => {
  assert.deepEqual(USER_STATUSES, ['pending', 'active', 'deactivated']);
  for (const bad of ['admin', 'ACTIVE', '', 'active; DROP TABLE users', null, undefined]) {
    assert.ok(!USER_STATUSES.includes(bad), `must reject: ${bad}`);
  }
});
