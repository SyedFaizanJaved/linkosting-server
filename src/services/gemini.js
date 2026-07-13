const LENGTH_WORDS = { short: '60-100', medium: '120-180', long: '200-280' };

export const ANGLES = [
  'Tell it as a personal story with a hard-won lesson.',
  'Take a bold, respectfully contrarian stance.',
  'Make it a practical, numbered list of actionable takeaways.',
];

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
- Near the end, on its own line, add exactly: Read more: ${article.link}
- End with 3-5 hashtags that genuinely fit THIS post's topic and content (prefer these if they fit: ${settings.hashtags}). Do not reuse a generic set on every post.
- Output ONLY the post text, nothing else.`;
}

export function buildVariantPrompt({ prompt, tone, length, angle }, settings) {
  return `You are ghostwriting a LinkedIn post for a professional working in: ${settings.topics}.
Persona: ${settings.tone}
Requested tone for this post: ${tone}
Angle: ${angle}

Write ONE LinkedIn post (${LENGTH_WORDS[length] || LENGTH_WORDS.medium} words) about:
${prompt}

Rules:
- The first line must hook the reader on its own.
- Short paragraphs (1-3 sentences), blank line between them.
- Do NOT include any URL or link (there is no real source to cite — never invent one).
- End with 3-5 hashtags that genuinely fit THIS post's topic and content (prefer these if they fit: ${settings.hashtags}). Do not reuse a generic set on every post.
- Output ONLY the post text, nothing else.`;
}

async function callGemini(text) {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const out = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!out) throw new Error('Gemini returned no text');
  return out;
}

export async function generatePost(article, settings) {
  return callGemini(buildPrompt(article, settings));
}

export async function generateVariants({ prompt, tone, length }, settings) {
  return Promise.all(ANGLES.map(angle =>
    callGemini(buildVariantPrompt({ prompt, tone, length, angle }, settings))
  ));
}
