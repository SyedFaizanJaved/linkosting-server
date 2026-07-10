# Linkosting — Server

Express API for the Linkosting LinkedIn assistant: daily AI drafts from RSS,
on-demand 3-variant generation, per-post scheduling, approval by email reply
or dashboard, publishing via the official LinkedIn API. The React dashboard
lives in the separate `linkedin-post-client` repo.

## Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| POST /api/jobs/generate | x-cron-secret | Daily auto-draft + approval email |
| POST /api/jobs/publish | x-cron-secret | Publish approved & due (`{"dryRun":true}` to test; dry run still applies email approvals, backfills slots, and skips stale drafts — only the LinkedIn call is skipped); runs every 15 min |
| POST /api/auth/login | — | Get dashboard JWT |
| POST /api/generate | JWT | 3 post variants from prompt + tone + length |
| GET /api/drafts?status=&topic=&q= | JWT | Filterable library |
| POST /api/drafts | JWT | Save manual/generated draft |
| PUT /api/drafts/:id · /schedule · /metrics | JWT | Edit, schedule, manual metrics |
| POST /api/drafts/:id/approve · /publish · /regenerate | JWT | Draft actions |
| GET/PUT /api/settings | JWT | Topics, tone, feeds, default post time (HH:MM UTC), onboarded |
| GET /api/analytics | JWT | Own-data aggregates + manual metric rollups |
| GET /api/notifications | JWT | Derived: pending reviews, recent posts, token expiry |
| GET /api/linkedin/auth-url, /callback | JWT / public | Connect LinkedIn (OAuth, 60-day token) |

## Setup (once)

1. **Database (Neon, free):** neon.tech → New Project → `DATABASE_URL`.
2. **Gemini:** aistudio.google.com/apikey → `GEMINI_API_KEY`.
3. **Gmail:** 2FA + App Password → `EMAIL_ADDRESS`, `EMAIL_APP_PASSWORD`.
4. **LinkedIn app:** developers.linkedin.com → products "Share on LinkedIn" +
   "Sign In with LinkedIn using OpenID Connect" → redirect URL
   `<SERVER_URL>/api/linkedin/callback` → `LINKEDIN_CLIENT_ID/SECRET`.
5. **Local:** `cp .env.example .env`, fill, `npm install && npm run db:init && npm run dev`.
6. **Deploy (Render, free):** Web Service, build `npm install`, start `npm start`,
   all env vars set. Run `npm run db:init` once against the same `DATABASE_URL`.
7. **Cron (GitHub Actions):** repo secrets `SERVER_URL`, `CRON_SECRET`.
   Generate 09:00 PKT daily; publish every 15 min. Manual test: Actions → cron →
   Run workflow → job=publish, dryRun=true.

## Scheduling model

Every draft can carry `scheduled_at` (set from the dashboard calendar). The
publish job posts whatever is `approved` with `scheduled_at <= now()`.
Daily drafts approved by email get `default_post_time` (HH:MM UTC) as their slot.
Unapproved daily drafts are skipped the next day. Publishing claims the row
atomically, so overlapping cron runs cannot double-post.

## Test

`npm test` (node:test, pure logic). Dry-run:
`curl -X POST $SERVER_URL/api/jobs/publish -H "x-cron-secret: $CRON_SECRET" -H "content-type: application/json" -d '{"dryRun":true}'`
