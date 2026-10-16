# thibaultsolutions.com

Tyler Thibault's creator / builder website plus the private **Creative Circle** video-processing lab.

## Production architecture

The site now runs behind a Next.js application built and deployed with Docker on Coolify. The public root still serves the preserved existing homepage source; Next powers Creative Circle and the application APIs.

The public homepage preserves the **Bold-Tech Mashup** direction documented in `STYLE_GUIDE.md`: **Bold first. Tech underneath.**

Creative Circle adds an authenticated application surface at:

- `/creative-circle`
- `/creative-circle/new`
- `/creative-circle/project/[id]`

The existing static reference pages remain in source control:

- `/store/`
- `/tech/`
- `/bold/`
- `/mashup/`

The production build copies those preserved pages into Next's public output and rewrites their existing URLs, so the migration does not require deleting the earlier site assets.

## Style guide

Read **`STYLE_GUIDE.md` before creating or significantly modifying any page.**

It remains the source of truth for colors, typography, layout, responsive behavior, component language, copy voice, accessibility, and the Bold-Tech visual system.

## Creative Circle

Read **`CREATIVE_CIRCLE.md`** for the application architecture, environment variables, storage model, worker process, effect engine, validation commands, and exact Coolify deployment steps.

Core runtime:

- Next.js / React / TypeScript
- PostgreSQL + Drizzle
- Better Auth
- pg-boss render queue
- FFmpeg / FFprobe
- persistent `/data` media volume
- separate web and render-worker processes from one Docker image

## Development

```bash
npm ci
npm run db:migrate
npm run db:seed-owner
npm run dev
```

Start the worker separately when testing final renders:

```bash
npm run build
npm run worker
```

Run validation with:

```bash
npm run typecheck
npm run lint
npm test
npm run test:effects
npm run build
# CI additionally boots web + worker and runs the authenticated render E2E test
docker build -t creative-circle .
```

Health check: `GET /api/health` verifies PostgreSQL and media directories, and reports the **running deployment** branch and Git commit:

```json
{
  "ok": true,
  "deployment": {
    "commit": "0123456789abcdef0123456789abcdef01234567",
    "shortCommit": "0123456",
    "branch": "main"
  }
}
```

Use `GET /api/health?expected=<commit-sha>` to compare the live container against any Git commit; a separate `matchesExpectedCommit` field reports true/false while `ok` continues to represent application readiness. The response is always non-cacheable. Coolify supplies `SOURCE_COMMIT` and `COOLIFY_BRANCH` at runtime; local/other deployments may set `APP_REVISION` and `APP_BRANCH`. If a revision is unavailable the API returns `null` instead of guessing. The endpoint must never expose secrets.

Do not commit real secrets or owner credentials.


## UGC lead discovery

The private UGC Radar at `/creative-circle/admin/ugc-brands` can watch public company recruiting sources without a paid search API.

Supported discovery paths:

- Greenhouse public job boards
- Lever public job boards, including EU boards
- Ashby public job boards
- Standard HTTPS careers pages, including pages that link through to Greenhouse, Lever, or Ashby

Add a company name and its careers/job-board URL in the admin UI, then use **Refresh all leads** or check one company at a time. Matching creator/UGC/social-content openings update or create CRM leads and record the last verified time.

For optional scheduled refreshes, set a strong `UGC_DISCOVERY_CRON_TOKEN` and have Coolify call:

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer $UGC_DISCOVERY_CRON_TOKEN" \
  https://thibaultsolutions.com/api/creative-circle/admin/ugc-targets/cron
```

The cron endpoint is disabled unless the token is configured. Discovery requests only accept public HTTPS sources and reject local/private network destinations.
