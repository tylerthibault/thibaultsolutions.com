FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/dist-worker ./dist-worker
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
RUN mkdir -p /data/uploads /data/renders /data/thumbnails /data/temp && chown -R node:node /data /app
USER node
EXPOSE 3000
CMD ["node", "server.js"]
