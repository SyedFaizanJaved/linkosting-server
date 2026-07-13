import { query } from '../db/index.js';
import { sendMail } from '../services/email.js';

const THRESHOLD_MS = 4 * 3600 * 1000;

export function selectReminderDrafts(drafts, now) {
  return drafts.filter(d =>
    d.status === 'pending' && !d.reminder_sent &&
    (now - new Date(d.created_at)) >= THRESHOLD_MS);
}

export async function runReminders() {
  const { rows } = await query(
    `SELECT d.id, d.status, d.reminder_sent, d.created_at, d.content, d.edited_content, u.email
     FROM drafts d JOIN users u ON u.id = d.user_id
     WHERE d.status='pending' AND d.reminder_sent=false AND u.status='active'`
  );
  const due = selectReminderDrafts(rows, new Date());
  for (const d of due) {
    const text = d.edited_content || d.content;
    try {
      await sendMail(`Reminder: your draft #${d.id} is still waiting`,
        `You haven't approved this post yet:\n\n${text}\n\nReply OK to approve, or open the dashboard.`, d.email);
      await query('UPDATE drafts SET reminder_sent=true WHERE id=$1', [d.id]);
    } catch (e) { console.error(`reminder for draft ${d.id} failed:`, e.message); }
  }
  return { reminded: due.map(d => d.id) };
}
