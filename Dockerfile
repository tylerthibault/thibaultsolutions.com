FROM mwader/static-ffmpeg:9.0.1 AS ffmpeg

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN BUILD_AUTH_SECRET="$(sha256sum package-lock.json | cut -d' ' -f1)" && APP_URL=http://localhost:3000 BETTER_AUTH_SECRET="$BUILD_AUTH_SECRET" npm run build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=ffmpeg /ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg /ffprobe /usr/local/bin/ffprobe

COPY --chown=node:node --from=build /app/.next/standalone ./
COPY --chown=node:node --from=build /app/.next/static ./.next/static
COPY --chown=node:node --from=build /app/public ./public
COPY --chown=node:node --from=build /app/drizzle ./drizzle
COPY --chown=node:node --from=build /app/dist-worker ./dist-worker
COPY --chown=node:node --from=build /app/src ./src
COPY --chown=node:node --from=build /app/package.json ./package.json
COPY --chown=node:node --from=deps /app/node_modules ./node_modules

RUN mkdir -p /data/uploads /data/renders /data/thumbnails /data/temp \
    && chown node:node /data /data/uploads /data/renders /data/thumbnails /data/temp \
    && ffmpeg -version >/dev/null \
    && ffprobe -version >/dev/null

USER node
EXPOSE 3000
CMD ["node", "server.js"]
