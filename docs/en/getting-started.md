# Getting Started

## Prerequisites

| Tool | Minimum Version | Purpose |
|---|---|---|
| **Node.js** | 20.0.0 | JavaScript runtime |
| **pnpm** | 9.15+ | Package manager |
| **Docker** | 24+ | Container runtime |
| **Docker Compose** | 2.20+ | Multi-container orchestration |
| **Git** | 2.40+ | Version control |

## Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/testing-ai-assistant.git
cd testing-ai-assistant
```

## Step 2: Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

### Environment Variables Reference

#### Identity Service

| Variable | Default | Description |
|---|---|---|
| `IDENTITY_DB_URL` | `postgresql://postgres:postgres@localhost:5441/identity_db` | Database connection string |
| `IDENTITY_PORT` | `3001` | Service port |
| `JWT_SECRET` | `super-secret-dev-key-change-in-production` | JWT signing secret |
| `JWT_EXPIRATION` | `1h` | Access token TTL |
| `JWT_REFRESH_EXPIRATION` | `7d` | Refresh token TTL |

#### Organization Service

| Variable | Default | Description |
|---|---|---|
| `ORG_DB_URL` | `postgresql://postgres:postgres@localhost:5434/org_db` | Database connection string |
| `ORG_PORT` | `3002` | Service port |

#### Project Service

| Variable | Default | Description |
|---|---|---|
| `PROJECT_DB_URL` | `postgresql://postgres:postgres@localhost:5437/project_db` | Database connection string |
| `PROJECT_PORT` | `3003` | Service port |

#### Pipeline Service

| Variable | Default | Description |
|---|---|---|
| `PIPELINE_DB_URL` | `postgresql://postgres:postgres@localhost:5438/pipeline_db` | Database connection string |
| `PIPELINE_PORT` | `3004` | Service port |

#### AI Service

| Variable | Default | Description |
|---|---|---|
| `AI_DB_URL` | `postgresql://postgres:postgres@localhost:5440/ai_db` | Database connection string |
| `AI_PORT` | `3005` | Service port |
| `OPENAI_API_KEY` | (empty) | OpenAI API key (required for AI features) |
| `OPENAI_MODEL_FAST` | `gpt-4.1-mini` | Fast model for lightweight tasks |
| `OPENAI_MODEL_ADVANCED` | `o3` | Advanced model for complex reasoning |

#### Notification Service

| Variable | Default | Description |
|---|---|---|
| `NOTIFICATION_DB_URL` | `postgresql://postgres:postgres@localhost:5439/notify_db` | Database connection string |
| `NOTIFICATION_PORT` | `3006` | Service port |
| `SMTP_HOST` | (empty) | SMTP server for email notifications |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | (empty) | SMTP username |
| `SMTP_PASS` | (empty) | SMTP password |
| `SLACK_BOT_TOKEN` | (empty) | Slack bot token for Slack notifications |
| `TELEGRAM_BOT_TOKEN` | (empty) | Telegram bot token for Telegram notifications |

#### Keycloak

| Variable | Default | Description |
|---|---|---|
| `KEYCLOAK_URL` | `http://localhost:8180` | Keycloak server URL |
| `KEYCLOAK_REALM` | `testing-ai` | Keycloak realm name |
| `KEYCLOAK_ADMIN` | `admin` | Admin username |
| `KEYCLOAK_ADMIN_PASSWORD` | `admin` | Admin password |

#### OAuth Providers

| Variable | Description |
|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |
| `GITLAB_CLIENT_ID` | GitLab OAuth app client ID |
| `GITLAB_CLIENT_SECRET` | GitLab OAuth app client secret |
| `BITBUCKET_CLIENT_ID` | Bitbucket OAuth app client ID |
| `BITBUCKET_CLIENT_SECRET` | Bitbucket OAuth app client secret |

#### Infrastructure

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6380` | Redis connection URL |
| `KAFKA_BROKERS` | `localhost:19092` | Redpanda/Kafka broker addresses |
| `MINIO_ENDPOINT` | `localhost` | MinIO endpoint |
| `MINIO_PORT` | `19000` | MinIO port |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO secret key |
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal server address |

#### Dashboard

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Identity API URL |
| `NEXTAUTH_URL` | `http://localhost:4200` | NextAuth base URL |
| `NEXTAUTH_SECRET` | `nextauth-secret-dev-key` | NextAuth encryption secret |
| `NEXT_PUBLIC_NOTIFICATION_API_URL` | `http://localhost:3006` | Notification API URL |
| `NEXT_PUBLIC_AI_API_URL` | `http://localhost:3005` | AI API URL |
| `NEXT_PUBLIC_PROJECT_API_URL` | `http://localhost:3003` | Project API URL |
| `NEXT_PUBLIC_PIPELINE_API_URL` | `http://localhost:3004` | Pipeline API URL |

#### Observability

| Variable | Default | Description |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OpenTelemetry collector endpoint |
| `OTEL_SERVICE_NAME` | `testing-ai` | Service name for traces |
| `GRAFANA_URL` | `http://localhost:3300` | Grafana dashboard URL |

## Step 3: Start Infrastructure Services

Launch all infrastructure dependencies (databases, Redpanda, Redis, Keycloak, Temporal, MinIO, observability stack):

```bash
# Start all containers in detached mode
pnpm docker:up

# Or equivalently:
docker compose up -d
```

Wait for all services to become healthy:

```bash
docker compose ps
```

All containers should show status `healthy` or `running`.

### Infrastructure Ports

| Service | Port | UI |
|---|---|---|
| Keycloak | 8180 | http://localhost:8180 |
| Temporal UI | 8233 | http://localhost:8233 |
| Redpanda Console | 18080 | http://localhost:18080 |
| MinIO Console | 19001 | http://localhost:19001 |
| Grafana | 3300 | http://localhost:3300 |
| Prometheus | 9090 | http://localhost:9090 |

## Step 4: Install Dependencies

```bash
pnpm install
```

## Step 5: Generate Prisma Clients and Run Migrations

```bash
# Generate Prisma client code for all services
pnpm db:generate

# Run database migrations for all services
pnpm db:migrate
```

## Step 6: Start All Services in Development Mode

```bash
pnpm dev
```

This uses Turborepo to start all services and apps concurrently in watch mode.

### Individual Service Ports

| Service | URL |
|---|---|
| Identity Service | http://localhost:3001 |
| Organization Service | http://localhost:3002 |
| Project Service | http://localhost:3003 |
| Pipeline Service | http://localhost:3004 |
| AI Service | http://localhost:3005 |
| Notification Service | http://localhost:3006 |
| Dashboard | http://localhost:4200 |

## Step 7: Verify Everything Works

1. **Dashboard**: Open http://localhost:4200 -- you should see the login page
2. **Register a user**: Navigate to http://localhost:4200/register and create an account
3. **API health check**: Each service exposes a `/health` endpoint:
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3002/health
   curl http://localhost:3003/health
   curl http://localhost:3004/health
   curl http://localhost:3005/health
   curl http://localhost:3006/health
   ```
4. **Grafana**: Open http://localhost:3300 (admin/admin) to view dashboards
5. **Temporal UI**: Open http://localhost:8233 to see workflow executions
6. **Redpanda Console**: Open http://localhost:18080 to inspect Kafka topics

## Common Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start all services in development mode |
| `pnpm build` | Build all packages and services |
| `pnpm lint` | Run linters across all packages |
| `pnpm test` | Run tests across all packages |
| `pnpm format` | Format all code with Prettier |
| `pnpm format:check` | Check formatting without modifying files |
| `pnpm docker:up` | Start infrastructure containers |
| `pnpm docker:down` | Stop infrastructure containers |
| `pnpm docker:reset` | Reset infrastructure (destroy volumes and restart) |
| `pnpm db:generate` | Generate Prisma clients for all services |
| `pnpm db:migrate` | Run Prisma migrations for all services |
| `pnpm clean` | Clean build artifacts across all packages |

## Troubleshooting

### Port Conflicts

If you see `EADDRINUSE` errors, check that no other services are using the required ports. The project uses non-standard ports (5434-5441 for PostgreSQL, 6380 for Redis, etc.) to minimize conflicts with locally installed services.

### Database Connection Issues

Ensure Docker containers are running and healthy before running migrations:

```bash
docker compose ps
```

If a PostgreSQL container is unhealthy, check its logs:

```bash
docker compose logs pg-identity
```

### Prisma Client Out of Sync

If you see type errors related to Prisma after pulling changes:

```bash
pnpm db:generate
```

### Clearing Everything

To start completely fresh:

```bash
pnpm docker:reset
pnpm db:generate
pnpm db:migrate
```
