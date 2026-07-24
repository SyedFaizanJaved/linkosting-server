import test, { mock } from 'node:test';
import assert from 'node:assert';

process.env.RL_AUTH_MAX = '2';
process.env.RL_AUTH_WINDOW_MS = '60000';
process.env.RL_PUBLIC_MAX = '3';
process.env.RL_PUBLIC_WINDOW_MS = '60000';

const { authLimiter, publicLimiter, resetRateLimits } = await import('../src/middleware/rateLimit.js');

// Minimal req/res doubles; returns whether next() was called plus the response.
function run(mw, req) {
  const res = {
    headers: {},
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
  };
  let next = false;
  mw(req, res, () => { next = true; });
  return { res, next };
}

test('authLimiter allows up to max, then 429s with Retry-After', () => {
  resetRateLimits();
  const req = { ip: '1.2.3.4', body: { email: 'a@x.com' } };
  assert.ok(run(authLimiter, req).next);
  assert.ok(run(authLimiter, req).next);
  const third = run(authLimiter, req);
  assert.equal(third.next, false);
  assert.equal(third.res.code, 429);
  assert.ok(Number(third.res.headers['Retry-After']) > 0);
});

test('authLimiter keys per account across IPs (case-insensitive email)', () => {
  resetRateLimits();
  run(authLimiter, { ip: '1.1.1.1', body: { email: 'v@x.com' } });
  run(authLimiter, { ip: '2.2.2.2', body: { email: 'v@x.com' } });
  const r = run(authLimiter, { ip: '3.3.3.3', body: { email: ' V@X.com ' } });
  assert.equal(r.res.code, 429);
});

test('different IP and account is unaffected by another key being limited', () => {
  resetRateLimits();
  const hot = { ip: '9.9.9.9', body: { email: 'hot@x.com' } };
  run(authLimiter, hot); run(authLimiter, hot); run(authLimiter, hot);
  assert.ok(run(authLimiter, { ip: '8.8.8.8', body: { email: 'cold@x.com' } }).next);
});

test('backoff doubles the block on consecutive violations, resets after a clean window', () => {
  resetRateLimits();
  mock.timers.enable({ apis: ['Date'], now: 0 });
  try {
    const req = { ip: '5.5.5.5', body: { email: 'b@x.com' } };
    run(authLimiter, req); run(authLimiter, req);
    const v1 = run(authLimiter, req);                       // strike 1 -> block 60s
    assert.equal(Number(v1.res.headers['Retry-After']), 60);

    mock.timers.setTime(61_000);                            // block over, fresh window
    run(authLimiter, req); run(authLimiter, req);
    const v2 = run(authLimiter, req);                       // strike 2 -> block 120s
    assert.equal(Number(v2.res.headers['Retry-After']), 120);

    mock.timers.setTime(61_000 + 120_000 + 61_000);         // clean expired window passed
    run(authLimiter, req); run(authLimiter, req);
    const v3 = run(authLimiter, req);                       // strikes reset -> 60s again
    assert.equal(Number(v3.res.headers['Retry-After']), 60);
  } finally { mock.timers.reset(); }
});

test('publicLimiter keys per IP only', () => {
  resetRateLimits();
  const req = { ip: '7.7.7.7' };
  run(publicLimiter, req); run(publicLimiter, req); run(publicLimiter, req);
  assert.equal(run(publicLimiter, req).res.code, 429);
  assert.ok(run(publicLimiter, { ip: '7.7.7.8' }).next);
});
