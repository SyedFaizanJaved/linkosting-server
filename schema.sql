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

ALTER TABLE drafts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS impressions INT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS reactions INT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS comments INT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS image BYTEA;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS image_mime TEXT;

-- Multi-tenancy migration (idempotent, non-destructive)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE drafts ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id);
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INT PRIMARY KEY REFERENCES users(id),
  topics TEXT DEFAULT '',
  tone TEXT DEFAULT '',
  hashtags TEXT DEFAULT '',
  feeds TEXT DEFAULT '[]',
  default_post_time TEXT DEFAULT '12:00',
  onboarded BOOLEAN NOT NULL DEFAULT false,
  daily_draft_enabled BOOLEAN NOT NULL DEFAULT false,
  linkedin_token TEXT,
  linkedin_member_urn TEXT,
  linkedin_token_expires_at TIMESTAMPTZ,
  linkedin_oauth_state TEXT,
  gen_count INT NOT NULL DEFAULT 0,
  image_count INT NOT NULL DEFAULT 0,
  usage_date DATE
);

-- Promote the first/only existing user to admin+active
UPDATE users SET role='admin', status='active'
  WHERE id = (SELECT id FROM users ORDER BY id LIMIT 1)
    AND NOT EXISTS (SELECT 1 FROM users WHERE role='admin');

-- Assign all existing drafts to the admin
UPDATE drafts SET user_id = (SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1)
  WHERE user_id IS NULL;

-- Seed the admin's user_settings row from the old global settings key/value table
INSERT INTO user_settings (user_id, topics, tone, hashtags, feeds, default_post_time, onboarded,
    linkedin_token, linkedin_member_urn, linkedin_token_expires_at)
SELECT a.id,
  COALESCE((SELECT value FROM settings WHERE key='topics'), ''),
  COALESCE((SELECT value FROM settings WHERE key='tone'), ''),
  COALESCE((SELECT value FROM settings WHERE key='hashtags'), ''),
  COALESCE((SELECT value FROM settings WHERE key='feeds'), '[]'),
  COALESCE((SELECT value FROM settings WHERE key='default_post_time'), '12:00'),
  COALESCE(NULLIF((SELECT value FROM settings WHERE key='onboarded'), ''), 'false')::boolean,
  (SELECT value FROM settings WHERE key='linkedin_token'),
  (SELECT value FROM settings WHERE key='linkedin_member_urn'),
  NULLIF((SELECT value FROM settings WHERE key='linkedin_token_expires_at'), '')::timestamptz
FROM (SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1) a
ON CONFLICT (user_id) DO NOTHING;
