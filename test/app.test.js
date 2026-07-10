import test from 'node:test';
import assert from 'node:assert';

process.env.JWT_SECRET = 'test-secret';
process.env.CRON_SECRET = 'test-cron';

const { buildApp } = await import('../src/app.js');

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
