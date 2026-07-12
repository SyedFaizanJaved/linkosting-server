import test from 'node:test';
import assert from 'node:assert';
import { validateScheduledAt } from '../src/util.js';

const NOW = Date.parse('2026-07-12T12:00:00Z');

test('null is valid (clears the schedule)', () => {
  assert.equal(validateScheduledAt(null, NOW), null);
});

test('future ISO datetime is valid', () => {
  assert.equal(validateScheduledAt('2026-07-12T13:00:00Z', NOW), null);
});

test('within the 2-minute grace window is valid', () => {
  assert.equal(validateScheduledAt('2026-07-12T11:59:00Z', NOW), null);
});

test('past datetime is rejected', () => {
  assert.equal(validateScheduledAt('2026-07-12T11:00:00Z', NOW), 'scheduled_at is in the past');
});

test('garbage and undefined are rejected as non-ISO', () => {
  assert.equal(validateScheduledAt('tomorrowish', NOW), 'scheduled_at must be an ISO datetime or null');
  assert.equal(validateScheduledAt(undefined, NOW), 'scheduled_at must be an ISO datetime or null');
});
