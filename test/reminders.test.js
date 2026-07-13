import test from 'node:test';
import assert from 'node:assert';
import { selectReminderDrafts } from '../src/jobs/reminders.js';

const NOW = new Date('2026-07-13T15:00:00Z');

test('selects pending, un-reminded drafts older than the threshold', () => {
  const drafts = [
    { id: 1, status: 'pending', reminder_sent: false, created_at: '2026-07-13T06:00:00Z' },
    { id: 2, status: 'pending', reminder_sent: true, created_at: '2026-07-13T06:00:00Z' },
    { id: 3, status: 'approved', reminder_sent: false, created_at: '2026-07-13T06:00:00Z' },
    { id: 4, status: 'pending', reminder_sent: false, created_at: '2026-07-13T14:30:00Z' },
  ];
  assert.deepEqual(selectReminderDrafts(drafts, NOW).map(d => d.id), [1]);
});
