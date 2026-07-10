# LinkedIn Post Automation — Server

Express API that drafts one LinkedIn post per day (Gemini + RSS), collects
approval (email reply or dashboard), and publishes via the official LinkedIn API.
Client dashboard lives in a separate repo.

## Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| POST /api/jobs/generate | x-cron-secret | Draft today's post, email it |
| POST /api/jobs/publish | x-cron-secret | Publish if approved (`{"dryRun":true}` to test) |
| POST /api/auth/login | — | Get dashboard JWT |
| GET/PUT /api/drafts... | JWT | Dashboard draft actions |
| GET/PUT /api/settings | JWT | Topics, feeds, tone, LinkedIn status |
| GET /api/linkedin/auth-url, /callback | JWT / public | Connect LinkedIn (OAuth) |

## Setup (once)

1. **Database (Neon, free):** create a project at neon.tech, copy the connection
   string into `DATABASE_URL`.
2. **Gemini:** free API key at aistudio.google.com/apikey → `GEMINI_API_KEY`.
3. **Gmail:** enable 2FA, create an App Password (Account → Security → App
   passwords) → `EMAIL_ADDRESS` + `EMAIL_APP_PASSWORD`. Drafts are sent to
   `APPROVER_EMAIL`; replies are read from this inbox via IMAP.
4. **LinkedIn app:** developers.linkedin.com → Create app → add products
   "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect" →
   Auth tab: add redirect URL `<SERVER_URL>/api/linkedin/callback` → copy
   `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`.
5. **Local:** copy `.env.example` → `.env`, fill everything, then
   `npm install && npm run db:init && npm run dev`.
6. **Deploy (Render, free):** New Web Service from this repo. Build `npm install`,
   start `npm start`. Add all env vars from `.env.example` (set `SERVER_URL` to the
   Render URL, `CLIENT_ORIGIN` to the deployed client URL). Then run
   `npm run db:init` once locally against the same `DATABASE_URL`.
7. **Connect LinkedIn:** log in to the dashboard → Settings → Connect LinkedIn.
   Token lasts 60 days; you get a warning email 7 days before expiry — reconnect
   the same way.
8. **Cron (GitHub Actions):** in this repo's GitHub settings add secrets
   `SERVER_URL` and `CRON_SECRET`. Schedule: 09:00 PKT generate, 17:00 PKT
   publish. Test manually: Actions → daily-cron → Run workflow → job=publish,
   dryRun=true.

## Daily flow

9 AM: draft generated + emailed. Reply `OK` to approve, reply with edited text
to replace it, or use the dashboard (edit / approve / post now / regenerate).
5 PM: approved draft is posted; no approval → skipped. Every failure emails you.

## Test

`npm test` (node:test). Publish dry-run:
`curl -X POST $SERVER_URL/api/jobs/publish -H "x-cron-secret: $CRON_SECRET" -H "content-type: application/json" -d '{"dryRun":true}'`
