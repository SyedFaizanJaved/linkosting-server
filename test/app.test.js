import test from 'node:test';
import assert from 'node:assert';

process.env.JWT_SECRET = 'test-secret';
process.env.CRON_SECRET = 'test-cron';
process.env.RL_PUBLIC_MAX = '3';

const { buildApp } = await import('../src/app.js');
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
