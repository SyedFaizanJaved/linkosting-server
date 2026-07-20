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

// ponytail: text generation is provider-switchable (AI_PROVIDER=gemini|groq).
// Image generation stays Gemini-only — Groq serves no image model. See image.js.
export const provider = () => (process.env.AI_PROVIDER || 'gemini').toLowerCase();

// Split from the fetch so the per-provider request/response shapes are testable
// without a network call.
export function buildRequest(name, text) {
  if (name === 'groq') {
    const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    return {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: { model, messages: [{ role: 'user', content: text }] },
    };
  }
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    headers: { 'content-type': 'application/json' },
    body: { contents: [{ parts: [{ text }] }] },
  };
}

export function parseResponse(name, data) {
  const out = name === 'groq'
    ? data.choices?.[0]?.message?.content?.trim()
    : data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!out) throw new Error(`${name} returned no text`);
  return out;
}

async function callLLM(text) {
  const name = provider();
  const { url, headers, body } = buildRequest(name, text);
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${name} ${res.status}: ${await res.text()}`);
  return parseResponse(name, await res.json());
}

export async function generatePost(article, settings) {
  return callLLM(buildPrompt(article, settings));
}

export async function generateVariants({ prompt, tone, length }, settings) {
  return Promise.all(ANGLES.map(angle =>
    callLLM(buildVariantPrompt({ prompt, tone, length, angle }, settings))
  ));
}
