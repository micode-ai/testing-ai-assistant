FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY services/ai/package.json ./services/ai/
RUN corepack enable pnpm && pnpm install --frozen-lockfile --filter @testing-ai/ai...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/ai/node_modules ./services/ai/node_modules
COPY . .
RUN pnpm --filter @testing-ai/ai build
RUN pnpm --filter @testing-ai/ai prisma:generate

FROM node:20-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs
WORKDIR /app
COPY --from=builder --chown=nestjs:nodejs /app/services/ai/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/services/ai/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/services/ai/package.json ./
USER nestjs
EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3005/health || exit 1
CMD ["node", "dist/main.js"]
