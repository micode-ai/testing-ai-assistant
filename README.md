[//]: # (This file mirrors docs/en/README.md — keep them in sync)

# Testing AI Assistant

> Full documentation available in [docs/en/](docs/en/README.md) | [docs/ru/](docs/ru/README.md)

**Testing AI Assistant** is an AI-powered test orchestration platform built on a microservices architecture. It automates test execution pipelines, generates tests using LLM agents, detects flaky tests and bugs, and delivers real-time notifications across multiple channels — all managed through a web dashboard and mobile app.

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, React 19, Tailwind CSS, shadcn/ui, next-intl |
| **Mobile** | Expo (React Native), Expo Router |
| **Backend** | NestJS (Node.js), TypeScript |
| **Databases** | PostgreSQL (per service), Redis (caching / queues) |
| **Messaging** | Redpanda (Kafka-compatible) |
| **Workflow** | Temporal |
| **AI** | Claude API (Anthropic) |
| **Storage** | MinIO (S3-compatible) |
| **Observability** | OpenTelemetry, Prometheus, Grafana, Loki, Tempo |
| **Infrastructure** | Docker Compose (dev), Kubernetes + Helm (prod), Terraform (AWS) |
| **CI/CD** | GitHub Actions, ArgoCD |

## Architecture

```
┌─────────────┐  ┌──────────────┐
│  Dashboard   │  │  Mobile App  │
│  (Next.js)   │  │  (Expo)      │
└──────┬───────┘  └──────┬───────┘
       │                 │
       └────────┬────────┘
                │
     ┌──────────▼──────────┐
     │   API Gateway /     │
     │   Traefik           │
     └──────────┬──────────┘
                │
  ┌─────────────┼─────────────────────────────┐
  │             │             │               │
  ▼             ▼             ▼               ▼
Identity    Organization   Project        Pipeline
Service     Service        Service        Service
  │             │             │               │
  ▼             ▼             ▼               ▼
pg-identity  pg-org       pg-project     pg-pipeline
                                              │
                                    ┌─────────▼─────────┐
                                    │  Temporal Server   │
                                    └─────────┬─────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │   Test Runner      │
                                    │   (Temporal Worker) │
                                    └─────────┬─────────┘
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                         AI Service    Notification      MinIO
                         (Claude)      Service           (Artifacts)
```

## Microservices

| Service | Port | Description |
|---|---|---|
| **identity** | 3001 | Authentication, JWT, OAuth (GitHub/GitLab/Bitbucket) |
| **organization** | 3002 | Organizations and membership management |
| **project** | 3003 | Project and git repository management |
| **pipeline** | 3004 | Pipeline definitions, test runs, results, SSE |
| **ai** | 3005 | LLM agents: test generation, bug detection, flaky tests |
| **notification** | 3006 | Email, Slack, Telegram, push notifications |
| **test-runner** | — | Temporal worker: executes pipeline steps (unit, lint, SAST, E2E, etc.) |

## Quick Start

```bash
# Prerequisites: Node.js 20+, pnpm 9+, Docker

# 1. Clone and install
git clone https://github.com/micode-ai/testing-ai-assistant.git
cd testing-ai-assistant
pnpm install

# 2. Start infrastructure (PostgreSQL, Redis, Temporal, MinIO, etc.)
docker compose up -d

# 3. Copy environment files
cp .env.example .env
cp apps/dashboard/.env.example apps/dashboard/.env.local

# 4. Run database migrations
pnpm -r exec prisma migrate dev

# 5. Start all services in dev mode
pnpm dev
```

Dashboard will be available at `http://localhost:3000`.

## Documentation

- **English**: [docs/en/](docs/en/README.md)
- **Russian**: [docs/ru/](docs/ru/README.md)
- **User Guides**: [user_docs/](user_docs/en/README.md)

## License

Private — all rights reserved.
