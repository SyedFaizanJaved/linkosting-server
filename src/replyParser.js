export function parseReply(text) {
  if (!text) return { action: 'none' };
  const kept = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*>/.test(line)) continue;
    if (/^On .+wrote:\s*$/.test(line.trim())) break;
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim())) break;
    kept.push(line);
  }
  const body = kept.join('\n').trim();
  if (!body) return { action: 'none' };
  if (/^(ok|okay|approve|approved|yes)[.!]*$/i.test(body)) return { action: 'approve' };
  return { action: 'edit', text: body };
}
