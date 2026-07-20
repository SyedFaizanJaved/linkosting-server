const RECENT_MS = 48 * 3600 * 1000;

export function parseList(v) {
  try { return Array.isArray(v) ? v : JSON.parse(v || '[]'); } catch { return []; }
}

// Notifications are derived (no table). Each gets a STABLE id so the dashboard
// can mark it read or dismiss it via the settings-stored read/dismissed lists.
// pendingUsers is only ever non-empty for an admin — the caller decides that.
export function deriveNotifications(drafts, settings, now = new Date(), pendingUsers = []) {
  const dismissed = new Set(parseList(settings.notif_dismissed));
  const read = new Set(parseList(settings.notif_read));
  const out = [];
  const add = n => { if (!dismissed.has(n.id)) out.push({ ...n, read: read.has(n.id) }); };

  for (const d of drafts) {
    if (d.status === 'pending') {
      add({ id: `review:${d.id}`, type: 'review', title: 'Draft waiting for review', detail: d.article_title, draftId: d.id });
    } else if (d.status === 'posted' && d.posted_at && now - new Date(d.posted_at) <= RECENT_MS) {
      add({ id: `posted:${d.id}`, type: 'posted', title: 'Published to LinkedIn', detail: d.article_title, draftId: d.id });
    }
  }

  for (const u of pendingUsers) {
    add({ id: `member:${u.id}`, type: 'member', title: 'New sign-up awaiting approval', detail: u.email });
  }

  if (settings.linkedin_token_expires_at) {
    const id = `token:${settings.linkedin_token_expires_at}`;
    const daysLeft = Math.floor((new Date(settings.linkedin_token_expires_at) - now) / 86400000);
    if (daysLeft < 0) {
      const daysAgo = Math.floor((now - new Date(settings.linkedin_token_expires_at)) / 86400000);
      add({ id, type: 'token', title: daysAgo === 0 ? 'LinkedIn connection expired today' : `LinkedIn connection expired ${daysAgo} day(s) ago`, detail: 'Reconnect in Settings to keep posting.' });
    } else if (daysLeft <= 7) {
      add({ id, type: 'token', title: daysLeft === 0 ? 'LinkedIn token expires today' : `LinkedIn token expires in ${daysLeft} day(s)`, detail: 'Reconnect in Settings.' });
    }
  }
  return out;
}
