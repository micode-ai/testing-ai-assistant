FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY services/organization/package.json ./services/organization/
RUN corepack enable pnpm && pnpm install --frozen-lockfile --filter @testing-ai/organization...

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/organization/node_modules ./services/organization/node_modules
COPY . .
RUN pnpm --filter @testing-ai/organization build
RUN pnpm --filter @testing-ai/organization prisma:generate

FROM node:20-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs
WORKDIR /app
COPY --from=builder --chown=nestjs:nodejs /app/services/organization/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/services/organization/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/services/organization/package.json ./
USER nestjs
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1
CMD ["node", "dist/main.js"]
