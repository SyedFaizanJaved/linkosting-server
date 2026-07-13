export function buildImagePrompt(postText, settings) {
  return `Create a single professional editorial illustration to accompany a LinkedIn post.

Post it accompanies:
"""${postText}"""

Requirements:
- Clean, modern, conceptual illustration that captures the post's core idea.
- Persona/tone to match: ${settings?.tone || 'professional, understated'}.
- Absolutely NO text, NO words, NO letters, NO numbers, NO logos anywhere in the image.
- Tasteful, restrained color; suitable for a professional feed. Avoid clip-art and generic stock-photo looks.
- Landscape orientation, safe for all audiences.`;
}

export async function generateImage(postText, settings) {
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: buildImagePrompt(postText, settings) }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini image ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const part = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!part) throw new Error('Gemini returned no image (possibly blocked) — try rephrasing the post.');
  return { bytes: Buffer.from(part.inlineData.data, 'base64'), mime: part.inlineData.mimeType || 'image/png' };
}
