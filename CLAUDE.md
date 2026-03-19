# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
# Install dependencies
pnpm install

# Start all infrastructure (PostgreSQL instances, Redis, Temporal, MinIO, etc.)
pnpm docker:up

# Run database migrations for all services
pnpm db:migrate

# Generate Prisma clients for all services
pnpm db:generate

# Start all services + dashboard in dev mode (via Turbo)
pnpm dev

# Build everything
pnpm build

# Lint all packages
pnpm lint

# Format code
pnpm format
```

### Single Service Development

```bash
# Run a specific service
cd services/pipeline && pnpm dev

# Run dashboard only
cd apps/dashboard && pnpm dev

# Run test-runner (Temporal worker)
cd services/test-runner && pnpm dev
```

### Testing

```bash
# Run all tests
pnpm test

# Single service tests
cd services/identity && pnpm test
cd services/identity && pnpm test:watch
cd services/identity && pnpm test:cov

# E2E tests
cd services/identity && pnpm test:e2e
```

### Database Operations

```bash
# Per-service Prisma commands
cd services/pipeline && npx prisma migrate dev --name description
cd services/pipeline && npx prisma generate
cd services/pipeline && npx prisma studio

# Apply migrations directly (when service is running and blocks prisma generate)
docker exec <pg-container> psql -U postgres -d <db_name> -c "SQL"
```

### Type-Checking

```bash
# Per-service (no global tsc)
cd services/pipeline && npx tsc --noEmit
cd services/test-runner && npx tsc --noEmit
```

## Architecture

**Monorepo** using pnpm workspaces + Turbo. 7 NestJS microservices with database-per-service pattern, Next.js 15 dashboard, Temporal workflow engine.

### Services & Ports

| Service | Port | Database | Purpose |
|---------|------|----------|---------|
| identity | 3001 | identity_db (5441) | Auth, JWT, OAuth (GitHub/GitLab/Bitbucket) |
| organization | 3002 | org_db (5434) | Orgs, memberships |
| project | 3003 | project_db (5437) | Git repos, webhooks |
| pipeline | 3004 | pipeline_db (5438) | Pipelines, test runs, results, checklists |
| ai | 3005 | ai_db (5440) | LLM agents (LangChain + OpenAI) |
| notification | 3006 | notify_db (5439) | Email, Slack, Telegram |
| test-runner | — | — | Temporal worker (no HTTP) |
| dashboard | 4200 | — | Next.js 15 frontend |

### Inter-Service Communication

- **Dashboard → Services**: Direct REST calls with JWT Bearer token from NextAuth session
- **Dashboard → Identity**: `POST /api/v1/users/batch` (no auth, `@Public()`) to resolve user IDs to names/emails (used by members page)
- **Pipeline → AI**: `POST /ai/generate` with type `CHECKLIST_ITEM_CHAT` for per-item AI chat in checklists (no auth, internal)
- **Pipeline → Project**: HTTP via `ProjectClient` to internal endpoint `/api/v1/projects/:id` (no auth)
- **Pipeline → Temporal**: Starts workflows (`testPipelineWorkflow`, `checklistRunWorkflow`)
- **Test Runner → Pipeline**: HTTP reporting to `/api/v1/runs/:id/status` and `/api/v1/checklist-runs/:id` (no auth, `@Public()` endpoints)
- **SSE**: Pipeline service → Dashboard at `/sse/runs/:runId` for real-time updates

### Internal vs Public Endpoints

Services use `@Public()` decorator + `@Controller('api/v1/...')` for inter-service calls (no JWT). Public-facing endpoints use `@UseGuards(JwtAuthGuard)`. All services must share the same `JWT_SECRET`.

### Key Patterns

- **NestJS modules**: Controller → Service → Repository → Prisma. DTOs for request/response. EventEmitter2 for domain events. Internal endpoints use separate `*-internal.controller.ts` files with `@Public()` + `@Controller('api/v1/...')`.
- **Prisma**: Each service has its own `prisma/schema.prisma` and `generated/prisma/` client (gitignored).
- **Dashboard API clients**: Each backend has its own fetch wrapper in `apps/dashboard/src/lib/api/`. Client components must pass `token` from `useSession()` explicitly — `auth()` only works server-side.
- **Dashboard navigation**: Sidebar uses tiered visibility controlled by Zustand store (`org-store.ts`): Tier 0 (always), Tier 1 (when org selected), Tier 2 (when project selected). Project context is synced from route params via `useProjectContext` hook in `projects/[projectId]/layout.tsx`.
- **AI Agents**: LangGraph state machines in `services/ai/src/agents/`. Pattern: analyze → generate → validate → refine (up to 3x) → format. Two models: `OPENAI_MODEL_ADVANCED` (o3) for generation, `OPENAI_MODEL_FAST` (gpt-4.1-mini) for validation.
- **Test execution**: Temporal workflows in `services/test-runner/src/workflows/`. Activities report progress via HTTP to pipeline service. Steps appear on UI via polling (3s) + SSE.

### Design Tokens (Dashboard)

Status and priority colors are CSS variables in `globals.css`, mapped to Tailwind in `tailwind.config.ts`:
- Status: `text-status-passed`, `text-status-failed`, `text-status-running`, etc.
- Priority: `bg-priority-high-bg text-priority-high-fg`, etc.
- Code blocks: `bg-code-bg text-code-fg`

Shared components: `PageSkeleton`, `ErrorAlert`, `EmptyState`, `RunStatusBadge` in `apps/dashboard/src/components/shared/`.

### Infrastructure

```bash
# Docker Compose includes: 8 PostgreSQL instances, Redis (6380), Redpanda/Kafka (19092),
# Temporal (7233) + UI (8233), MinIO (19000), Keycloak (8180),
# OTEL Collector, Prometheus (9090), Grafana (3300), Loki, Tempo

pnpm docker:up    # start
pnpm docker:down  # stop
pnpm docker:reset # destroy + recreate volumes
```
