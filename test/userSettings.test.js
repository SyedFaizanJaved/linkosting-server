import test from 'node:test';
import assert from 'node:assert';
import { nextUsage } from '../src/db/userSettings.js';

const CAP = { DAILY_TEXT_CAP: '3', DAILY_IMAGE_CAP: '2' };
for (const [k, v] of Object.entries(CAP)) process.env[k] = v;

test('fresh day resets counts then increments', () => {
  const r = nextUsage({ gen_count: 9, image_count: 9, usage_date: '2026-07-12' }, '2026-07-13', 'text');
  assert.deepEqual(r, { gen_count: 1, image_count: 0, usage_date: '2026-07-13', overCap: false });
});

test('same day increments text count', () => {
  const r = nextUsage({ gen_count: 1, image_count: 0, usage_date: '2026-07-13' }, '2026-07-13', 'text');
  assert.equal(r.gen_count, 2);
  assert.equal(r.overCap, false);
});

test('at cap is over cap and does not increment past the cap check', () => {
  const r = nextUsage({ gen_count: 3, image_count: 0, usage_date: '2026-07-13' }, '2026-07-13', 'text');
  assert.equal(r.overCap, true);
});

test('image kind uses image cap and column', () => {
  const r = nextUsage({ gen_count: 0, image_count: 2, usage_date: '2026-07-13' }, '2026-07-13', 'image');
  assert.equal(r.overCap, true);
});

test('null usage_date is treated as stale (first use)', () => {
  const r = nextUsage({ gen_count: 0, image_count: 0, usage_date: null }, '2026-07-13', 'text');
  assert.deepEqual(r, { gen_count: 1, image_count: 0, usage_date: '2026-07-13', overCap: false });
});
