const STATUSES = new Set(['pending', 'approved', 'posted', 'skipped']);

export function buildDraftsFilter({ status, topic, q } = {}) {
  const clauses = [];
  const params = [];
  if (status && STATUSES.has(status)) {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (topic) {
    params.push(topic);
    clauses.push(`topic = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    clauses.push(`(article_title ILIKE $${params.length} OR content ILIKE $${params.length})`);
  }
  return { where: clauses.length ? 'WHERE ' + clauses.join(' AND ') : '', params };
}
