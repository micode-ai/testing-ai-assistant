# Getting Started

## System Requirements

| Component | Minimum Version |
|-----------|----------------|
| Node.js | >= 20.0.0 |
| pnpm | >= 9.15.4 |
| Docker | >= 24.0 |
| Docker Compose | >= 2.20.0 |
| Git | >= 2.40.0 |

**Recommended Hardware:**
- RAM: 16 GB (minimum 8 GB)
- Disk: 10 GB free space
- CPU: 4+ cores

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/testing-ai-assistant.git
cd testing-ai-assistant
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and set the required values. Minimum configuration for local development:

```env
# JWT (required — change in production)
JWT_SECRET=super-secret-dev-key-change-in-production
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d

# Dashboard
NEXTAUTH_SECRET=nextauth-secret-dev-key
NEXTAUTH_URL=http://localhost:4200

# AI (required for AI features)
OPENAI_API_KEY=sk-your-key
```

The remaining variables (databases, Redis, Kafka, etc.) are pre-filled with local development defaults.

### 3. Start Infrastructure

```bash
pnpm docker:up
```

This starts all infrastructure containers:
- 6 PostgreSQL databases
- Redis
- Redpanda (Kafka)
- Temporal + Temporal UI
- Keycloak
- MinIO
- OpenTelemetry Collector
- Grafana, Prometheus, Loki, Tempo

Verify all containers are running:

```bash
docker compose ps
```

Wait until all containers reach `healthy` status (1-2 minutes).

### 4. Install Dependencies

```bash
pnpm install
```

### 5. Generate Prisma Clients and Run Migrations

```bash
pnpm db:generate
pnpm db:migrate
```

### 6. Start in Development Mode

```bash
pnpm dev
```

This launches all microservices and applications via Turborepo.

## Development URLs

| Service | URL |
|---------|-----|
| Web Dashboard | http://localhost:4200 |
| Identity Service | http://localhost:3001 |
| Organization Service | http://localhost:3002 |
| Project Service | http://localhost:3003 |
| Pipeline Service | http://localhost:3004 |
| AI Service | http://localhost:3005 |
| Notification Service | http://localhost:3006 |
| Keycloak | http://localhost:8180 |
| Temporal UI | http://localhost:8233 |
| Redpanda Console | http://localhost:18080 |
| MinIO Console | http://localhost:19001 |
| Grafana | http://localhost:3300 (admin/admin) |
| Prometheus | http://localhost:9090 |

## Quick Health Check

After startup, verify services are running:

```bash
# Check Identity Service
curl http://localhost:3001/health

# Check Pipeline Service
curl http://localhost:3004/health
```

All `/health` endpoints should return `200 OK`.

## Useful Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in development mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Run linter |
| `pnpm test` | Run tests |
| `pnpm format` | Format code |
| `pnpm clean` | Clean build artifacts |
| `pnpm docker:up` | Start infrastructure |
| `pnpm docker:down` | Stop infrastructure |
| `pnpm docker:reset` | Full infrastructure reset (deletes data) |
| `pnpm db:generate` | Generate Prisma clients |
| `pnpm db:migrate` | Apply database migrations |

## What's Next?

- [Architecture](./02-architecture.md) — learn the system structure
- [Web Dashboard](./03-dashboard.md) — start using the interface
- [Organizations & Projects](./05-organizations-projects.md) — create your first organization
