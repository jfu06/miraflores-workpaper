# The Node version is pinned, not inferred.
#
# The event store uses `node:sqlite`, a built-in module that is only available
# without a flag from Node 23.4 and stable in 24. A builder that guessed an older
# default would fail at the first write, so the version is stated here rather than
# left to detection.
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# The event log lives on a mounted volume, not in the image, so it survives a
# redeploy. `data/` in the image holds the packet and is read-only in practice.
ENV EVENTS_DB_PATH=/data/events.db

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/data/okafor_lindqvist_2025_packet.json ./data/

# The directory has to exist for the first boot before a volume is attached.
# No `VOLUME` instruction: Railway manages the mount itself and rejects one here.
RUN mkdir -p /data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
