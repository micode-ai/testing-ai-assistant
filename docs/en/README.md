# Testing AI Assistant

**Testing AI Assistant** is an AI-powered test orchestration platform built on a microservices architecture. It automates test execution pipelines, generates tests using LLM agents, detects flaky tests and bugs, and delivers real-time notifications across multiple channels -- all managed through a web dashboard and mobile app.

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| **Monorepo** | Turborepo + pnpm workspaces | Turbo 2.3, pnpm 9.15 |
| **Language** | TypeScript | 5.6+ |
| **Backend Framework** | NestJS | 10.x |
| **Frontend (Web)** | Next.js 15 (App Router) + React 19 | 15.1 |
| **Frontend (Mobile)** | Expo + React Native | Expo 52, RN 0.76 |
| **Database** | PostgreSQL (one per service) | 16 |
| **ORM** | Prisma | Latest |
| **Message Broker** | Redpanda (Kafka-compatible) | 24.1 |
| **Workflow Orchestration** | Temporal | 1.24 |
| **Identity Provider** | Keycloak | 24.0 |
| **Object Storage** | MinIO | Latest |
| **Cache** | Redis | 7 |
| **API Gateway** | Traefik | 3.x |
| **Observability** | OpenTelemetry, Grafana, Loki, Tempo, Prometheus | Various |
| **AI Models** | OpenAI (gpt-4.1-mini / o3) via LangGraph | Latest |
| **CI/CD** | GitHub Actions + ArgoCD | - |
| **IaC** | Terraform + Helm | - |

## Documentation Index

### General

| Document | Description |
|---|---|
| [System Architecture](./architecture.md) | High-level architecture, service interactions, design principles |
| [Getting Started](./getting-started.md) | Prerequisites, setup, running the project |
| [API Reference](./api-reference.md) | Consolidated endpoint reference for all services |
| [Database Architecture](./database.md) | Database-per-service pattern, ER diagrams, migrations |
| [Event-Driven Architecture](./event-driven.md) | Redpanda topics, event flows, EventEmitter2 internals |
| [Deployment Guide](./deployment.md) | Docker Compose, Kubernetes, Helm, ArgoCD, Terraform |
| [Observability](./observability.md) | Tracing, logging, metrics, Grafana dashboards |
| [Security](./security.md) | Authentication, authorization, TLS, OWASP |

### Services

| Document | Service | Port |
|---|---|---|
| [Identity Service](./services/identity.md) | Authentication & user management | 3001 |
| [Organization Service](./services/organization.md) | Organizations & memberships | 3002 |
| [Project Service](./services/project.md) | Projects & git provider integration | 3003 |
| [Pipeline Service](./services/pipeline.md) | Pipelines, test runs, results | 3004 |
| [AI Service](./services/ai.md) | LLM-powered test generation & analysis | 3005 |
| [Notification Service](./services/notification.md) | Multi-channel notifications | 3006 |
| [Test Runner Service](./services/test-runner.md) | Temporal-based test execution | Worker |

### Client Applications

| Document | Description |
|---|---|
| [Dashboard (Web)](./dashboard.md) | Next.js 15 web application |
| [Mobile App](./mobile.md) | Expo / React Native mobile application |

## Repository Structure

```
testing-ai-assistant/
  apps/
    dashboard/          # Next.js 15 web dashboard
    mobile/             # Expo React Native mobile app
  services/
    identity/           # Auth & user management (port 3001)
    organization/       # Org & membership (port 3002)
    project/            # Projects & webhooks (port 3003)
    pipeline/           # Pipelines & test runs (port 3004)
    ai/                 # AI generation agents (port 3005)
    notification/       # Notification dispatch (port 3006)
    test-runner/        # Temporal worker
  packages/
    shared-types/       # Shared TypeScript types
    git-adapter/        # Git provider abstraction (GitHub/GitLab/Bitbucket)
  infrastructure/
    traefik/            # API gateway configuration
    observability/      # Grafana, Loki, Tempo, Prometheus, OTel configs
    helm/               # Helm charts for Kubernetes deployment
    terraform/          # Infrastructure-as-Code
  docker-compose.yml    # Local development environment
  turbo.json            # Turborepo pipeline configuration
  pnpm-workspace.yaml   # pnpm workspace definition
```
