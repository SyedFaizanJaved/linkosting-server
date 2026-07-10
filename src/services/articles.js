import Parser from 'rss-parser';

export function pickFresh(items, usedUrls) {
  const used = new Set(usedUrls);
  const fresh = items.filter(i => i.link && !used.has(i.link));
  fresh.sort((a, b) => new Date(b.isoDate || 0) - new Date(a.isoDate || 0));
  return fresh[0] || null;
}

export async function fetchCandidates(feedUrls) {
  const parser = new Parser({ timeout: 15000 });
  const results = await Promise.allSettled(feedUrls.map(u => parser.parseURL(u)));
  return results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value.items.map(i => ({
      title: i.title || '(untitled)',
      link: i.link || '',
      snippet: (i.contentSnippet || '').slice(0, 500),
      isoDate: i.isoDate || i.pubDate || '',
    })));
}
