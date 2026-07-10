export function buildPrompt(article, settings) {
  return `You are ghostwriting a LinkedIn post for a professional working in: ${settings.topics}.
Tone and persona: ${settings.tone}

Write ONE LinkedIn post (120-220 words) reacting to this article:
Title: ${article.title}
Summary: ${article.snippet}

Rules:
- The first line must hook the reader on its own.
- Short paragraphs (1-3 sentences), blank line between them.
- Give one concrete, practical takeaway.
- Do NOT include any URL.
- End with these hashtags: ${settings.hashtags}
- Output ONLY the post text, nothing else.`;
}

export async function generatePost(article, settings) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(article, settings) }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Gemini returned no text');
  return text;
}
