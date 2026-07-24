import test from 'node:test';
import assert from 'node:assert';

process.env.JWT_SECRET = 'test-secret';
process.env.CRON_SECRET = 'test-cron';
process.env.RL_PUBLIC_MAX = '3';

const { buildApp, errorHandler } = await import('../src/app.js');
const { resetRateLimits } = await import('../src/middleware/rateLimit.js');

test('GET /api/health returns ok', async () => {
  const server = buildApp().listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  } finally {
    server.close();
  }
});

test('public endpoints rate limit with 429 after RL_PUBLIC_MAX requests', async () => {
  resetRateLimits();
  const server = buildApp().listen(0);
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/auth/status`;
    let last;
    for (let i = 0; i < 4; i++) last = await fetch(url);
    assert.equal(last.status, 429);
    assert.ok(last.headers.get('retry-after'));
  } finally { server.close(); }
});

test('mutations without auth still 401 (validation did not open a bypass)', async () => {
  resetRateLimits();
  const server = buildApp().listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const res = await fetch(`${base}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-requested-with': 't' },
      body: JSON.stringify({ prompt: 'x'.repeat(3000) }),
    });
    assert.equal(res.status, 401);
  } finally { server.close(); }
});

test('/api/jobs is exempt from the global limiter (still guarded by cron secret)', async () => {
  resetRateLimits();
  process.env.RL_API_MAX = '1';
  const server = buildApp().listen(0);
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/jobs/publish`;
    for (let i = 0; i < 3; i++) {
      const res = await fetch(url, { method: 'POST' });
      assert.equal(res.status, 401); // wrong secret, but never 429
    }
  } finally { server.close(); delete process.env.RL_API_MAX; }
});

test('errorHandler returns a generic 500 and logs the real error', () => {
  const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  const logged = [];
  const orig = console.error;
  console.error = (...a) => logged.push(a.join(' '));
  try {
    errorHandler(new Error('pg: password authentication failed for user "linkosting"'),
      { method: 'GET', path: '/api/drafts' }, res, () => {});
  } finally { console.error = orig; }
  assert.equal(res.code, 500);
  assert.deepEqual(res.body, { error: 'internal server error' });
  assert.ok(logged.join(' ').includes('password authentication failed'));
});

test('errorHandler turns body-parse errors into a clean 400', () => {
  const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  const err = Object.assign(new Error('Unexpected token'), { type: 'entity.parse.failed' });
  errorHandler(err, { method: 'POST', path: '/api/drafts' }, res, () => {});
  assert.equal(res.code, 400);
  assert.deepEqual(res.body, { error: 'invalid request body' });
});

test('responses carry X-Content-Type-Options: nosniff', async () => {
  resetRateLimits();
  const server = buildApp().listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  } finally { server.close(); }
});
