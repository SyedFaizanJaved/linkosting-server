export const ah = fn => (req, res, next) => fn(req, res, next).catch(next);

export function validateScheduledAt(value, now = Date.now()) {
  if (value === null) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return 'scheduled_at must be an ISO datetime or null';
  if (t < now - 2 * 60_000) return 'scheduled_at is in the past';
  return null;
}
