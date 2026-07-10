CREATE TABLE IF NOT EXISTS drafts (
  id SERIAL PRIMARY KEY,
  article_url TEXT UNIQUE NOT NULL,
  article_title TEXT NOT NULL,
  article_snippet TEXT,
  topic TEXT,
  content TEXT NOT NULL,
  edited_content TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','posted','skipped')),
  linkedin_post_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
