// Every draft column EXCEPT the image bytes, plus a has_image flag.
// Used wherever a draft row is returned to the client, so image/image_mime
// bytes never ship in JSON — they are served only by GET /api/drafts/:id/image.
export const DRAFT_COLS = `
  id, article_url, article_title, article_snippet, topic, content, edited_content,
  status, linkedin_post_id, created_at, posted_at, scheduled_at, source,
  impressions, reactions, comments, (image IS NOT NULL) AS has_image`;
