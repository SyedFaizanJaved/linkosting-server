import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret';
process.env.CRON_SECRET = 'test-cron';

const { requireJwt, requireCronSecret, requireCsrfHeader } = await import('../src/middleware/auth.js');

function mockRes() {
  return { code: null, status(c) { this.code = c; return this; }, json() { return this; } };
}

test('requireJwt accepts a valid access-token cookie', () => {
  const token = jwt.sign({ sub: 1 }, 'test-secret');
  let called = false;
  requireJwt({ cookies: { access_token: token } }, mockRes(), () => { called = true; });
  assert.ok(called);
});

test('requireJwt rejects missing/invalid cookie with 401', () => {
  for (const cookies of [undefined, {}, { access_token: 'bad' }]) {
    const res = mockRes();
    requireJwt({ cookies }, res, () => assert.fail('next called'));
    assert.equal(res.code, 401);
  }
});

test('requireCronSecret checks x-cron-secret header', () => {
  let called = false;
  requireCronSecret({ headers: { 'x-cron-secret': 'test-cron' } }, mockRes(), () => { called = true; });
  assert.ok(called);
  const res = mockRes();
  requireCronSecret({ headers: {} }, res, () => assert.fail('next called'));
  assert.equal(res.code, 401);
});

test('requireCsrfHeader: GET and cron jobs pass; other unsafe methods need the header', () => {
  let called;
  called = false;
  requireCsrfHeader({ method: 'GET', headers: {}, path: '/api/drafts' }, mockRes(), () => { called = true; });
  assert.ok(called, 'GET should pass');

  called = false;
  requireCsrfHeader({ method: 'POST', headers: {}, path: '/api/jobs/publish' }, mockRes(), () => { called = true; });
  assert.ok(called, 'cron job endpoint should pass');

  const res = mockRes();
  requireCsrfHeader({ method: 'POST', headers: {}, path: '/api/drafts' }, res, () => assert.fail('next called'));
  assert.equal(res.code, 403, 'POST without header should be 403');

  called = false;
  requireCsrfHeader({ method: 'POST', headers: { 'x-requested-with': 'fetch' }, path: '/api/drafts' }, mockRes(), () => { called = true; });
  assert.ok(called, 'POST with header should pass');
});

test('requireCronSecret fails closed when CRON_SECRET is unset', () => {
  const saved = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  const res = mockRes();
  requireCronSecret({ headers: {} }, res, () => assert.fail('next called'));
  assert.equal(res.code, 401);
  process.env.CRON_SECRET = saved;
});
