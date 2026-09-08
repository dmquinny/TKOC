# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Dependencies only change when package-lock.json changes, so this layer is
# reused by every ordinary code update. The npm cache mount makes the rare
# reinstall fast as well.
FROM base AS dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM base AS builder
ENV NODE_ENV=production
# Build-time placeholders only. Runtime values come from .env.production.
ENV DATABASE_URL=mysql://build:build@127.0.0.1:3306/build
ENV JWT_SECRET=build-only-placeholder
ENV CRON_SECRET=build-only-placeholder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM base AS migrator
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src/lib ./src/lib
COPY scripts ./scripts
RUN npx prisma generate
CMD ["npm", "run", "db:deploy"]

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3400

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts/tick-worker.mjs ./scripts/tick-worker.mjs

USER nextjs
EXPOSE 3400
CMD ["node", "server.js"]
