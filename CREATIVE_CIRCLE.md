# Creative Circle V1

Creative Circle is the private video-processing application integrated into ThibaultSolutions.com. The public website remains public; `/creative-circle/**` requires the owner session.

## Architecture

- Next.js 16 App Router + React + strict TypeScript
- PostgreSQL + Drizzle ORM
- Better Auth email/password authentication with public signup disabled
- pg-boss using the same PostgreSQL instance for persistent render jobs
- FFprobe for media validation/metadata, FFmpeg for thumbnails and final H.264/AAC MP4 output
- Local persistent media abstraction rooted at `MEDIA_STORAGE_PATH` (`/data` in Coolify)
- Browser canvas preview using the same effect IDs, seeds, and parameter object used by server export
- Separate web and worker processes built from the same Docker image

The original static `/store`, `/tech`, `/bold`, and `/mashup` directories stay in source control. `scripts/copy-legacy.mjs` copies them into Next's public directory before production builds and Next rewrites their original URLs to their preserved HTML.

## Required environment

Copy `.env.example` and configure:

- `DATABASE_URL` — PostgreSQL connection string shared by web and worker
- `APP_URL` — canonical origin, normally `https://thibaultsolutions.com`
- `BETTER_AUTH_SECRET` — long random secret
- `OWNER_EMAIL` / `OWNER_PASSWORD` — used by the explicit owner seed command
- `MEDIA_STORAGE_PATH=/data`
- `MAX_UPLOAD_SIZE` — bytes; defaults to 2 GiB in application code
- `FFMPEG_PATH` / `FFPROBE_PATH` — normally the defaults installed in the container

Never commit the real secret or owner password.

## First deployment / Coolify

1. Change the existing Coolify resource from a Static site to a Dockerfile application using this repository.
2. Add or attach a PostgreSQL 17 service and put its internal connection string in `DATABASE_URL`.
3. Create one persistent Coolify volume and mount it at `/data` on **both** the web and worker resources. It contains:
   - `/data/uploads`
   - `/data/renders`
   - `/data/thumbnails`
   - `/data/temp`
4. Configure the environment variables above on both processes.
5. Deploy the image once.
6. Run migrations using the built image: `npm run db:migrate`.
7. Bootstrap the private owner account once: `npm run db:seed-owner`.
8. Web process command: `node server.js`.
9. Worker process command: `node dist-worker/scripts/worker.js`.
10. Point `thibaultsolutions.com` at the web process only. The worker has no public route.

The worker and web process can scale separately later, but V1 requires only one of each.

## Storage and security

Uploaded names are metadata only. Files receive server-generated UUID keys, are written under controlled directories, and never become shell command fragments. FFmpeg/FFprobe are invoked through `spawn()` argument arrays. Upload MIME, extension, size, and actual media validity are checked before a project accepts the asset. Source and rendered media endpoints require the authenticated owner.

## Effects

The effect registry is `src/lib/effects/registry.ts`. It contains all 52 V1 effects, their descriptions, categories, defaults, ranges, and control types. Browser preview is in `src/lib/effects/preview.ts`; server export mapping is in `src/lib/effects/export.ts`. Procedural preview animation derives from video time + effect seed rather than wall clock.

The export smoke suite generates a synthetic H.264 clip and passes it through every export mapping. Run:

```bash
npm run test:effects
```

## Validation commands

```bash
npm install
npm run db:migrate
npm run typecheck
npm run lint
npm test
npm run test:effects
npm run build
docker build -t creative-circle .
```

CI runs the same validation against PostgreSQL 17 and an installed FFmpeg binary.
