# thibaultsolutions.com

Tyler Thibault's creator / builder website plus the private **Creative Circle** video-processing lab.

## Production architecture

The site now runs as a Next.js application built and deployed with Docker on Coolify.

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
npm install
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
docker build -t creative-circle .
```

Do not commit real secrets or owner credentials.
