const RECENT_MS = 48 * 3600 * 1000;

export function deriveNotifications(drafts, settings, now = new Date()) {
  const out = [];
  for (const d of drafts) {
    if (d.status === 'pending') {
      out.push({ type: 'review', title: 'Draft waiting for review', detail: d.article_title, draftId: d.id });
    } else if (d.status === 'posted' && d.posted_at && now - new Date(d.posted_at) <= RECENT_MS) {
      out.push({ type: 'posted', title: 'Published to LinkedIn', detail: d.article_title, draftId: d.id });
    }
  }
  if (settings.linkedin_token_expires_at) {
    const daysLeft = Math.floor((new Date(settings.linkedin_token_expires_at) - now) / 86400000);
    if (daysLeft < 0) {
      const daysAgo = Math.floor((now - new Date(settings.linkedin_token_expires_at)) / 86400000);
      out.push({
        type: 'token',
        title: daysAgo === 0 ? 'LinkedIn connection expired today' : `LinkedIn connection expired ${daysAgo} day(s) ago`,
        detail: 'Reconnect in Settings to keep posting.',
      });
    } else if (daysLeft <= 7) {
      out.push({
        type: 'token',
        title: daysLeft === 0 ? 'LinkedIn token expires today' : `LinkedIn token expires in ${daysLeft} day(s)`,
        detail: 'Reconnect in Settings.',
      });
    }
  }
  return out;
}
