import test from 'node:test';
import assert from 'node:assert';
import { weekSeries } from '../src/services/analytics.js';

const NOW = new Date('2026-07-10T12:00:00Z'); // a Friday; week starts Mon 2026-07-06

test('fills missing weeks with zero, oldest first', () => {
  const rows = [{ week: '2026-07-06T00:00:00.000Z', count: '3' }];
  const s = weekSeries(rows, 3, NOW);
  assert.equal(s.length, 3);
  assert.deepEqual(s[2], { weekStart: '2026-07-06', count: 3 });
  assert.deepEqual(s[0], { weekStart: '2026-06-22', count: 0 });
  assert.deepEqual(s[1], { weekStart: '2026-06-29', count: 0 });
});

test('empty rows -> all zeros', () => {
  const s = weekSeries([], 2, NOW);
  assert.deepEqual(s.map(x => x.count), [0, 0]);
});
