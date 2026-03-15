# Архитектура системы

## Высокоуровневая архитектура

Testing AI Assistant построен по принципу микросервисной архитектуры с событийно-ориентированным взаимодействием. Каждый сервис отвечает за свой ограниченный контекст (bounded context) и имеет собственную базу данных.

```mermaid
graph TB
    subgraph Клиенты
        DASH[Dashboard<br/>Next.js 15 App Router<br/>:4200]
        MOBILE[Mobile App<br/>Expo / React Native]
    end

    subgraph API Gateway
        TRAEFIK[Traefik<br/>Rate Limiting / JWT / TLS / CORS<br/>:443]
    end

    subgraph Микросервисы
        IDENTITY[Identity Service<br/>NestJS :3001]
        ORG[Organization Service<br/>NestJS :3002]
        PROJECT[Project Service<br/>NestJS :3003]
        PIPELINE[Pipeline Service<br/>NestJS :3004]
        AI[AI Service<br/>NestJS :3005]
        NOTIFICATION[Notification Service<br/>NestJS :3006]
        TEST_RUNNER[Test Runner Service<br/>Temporal Worker]
    end

    subgraph Шина событий
        REDPANDA[Redpanda<br/>Kafka-совместимый брокер<br/>:19092]
    end

    subgraph Оркестрация
        TEMPORAL[Temporal Server<br/>:7233]
        TEMPORAL_UI[Temporal UI<br/>:8233]
    end

    subgraph Базы данных
        PG_ID[(pg-identity<br/>:5441)]
        PG_ORG[(pg-org<br/>:5434)]
        PG_PRJ[(pg-project<br/>:5437)]
        PG_PIP[(pg-pipeline<br/>:5438)]
        PG_AI[(pg-ai<br/>:5440)]
        PG_NOT[(pg-notify<br/>:5439)]
        PG_KC[(pg-keycloak<br/>:5435)]
        PG_TMP[(pg-temporal<br/>:5436)]
    end

    subgraph Внешние сервисы
        KEYCLOAK[Keycloak<br/>IdP :8180]
        MINIO[MinIO<br/>S3-хранилище :19000]
        REDIS[(Redis<br/>Кэш :6380)]
    end

    subgraph Наблюдаемость
        OTEL[OTel Collector<br/>:4317/:4318]
        LOKI[Loki<br/>Логи :3100]
        TEMPO[Tempo<br/>Трейсы :3200]
        PROM[Prometheus<br/>Метрики :9090]
        GRAFANA[Grafana<br/>Дашборды :3300]
    end

    DASH & MOBILE --> TRAEFIK
    TRAEFIK --> IDENTITY & ORG & PROJECT & PIPELINE & AI & NOTIFICATION
    TRAEFIK --> DASH

    IDENTITY --> PG_ID
    ORG --> PG_ORG
    PROJECT --> PG_PRJ
    PIPELINE --> PG_PIP
    AI --> PG_AI
    NOTIFICATION --> PG_NOT
    KEYCLOAK --> PG_KC
    TEMPORAL --> PG_TMP

    IDENTITY --> KEYCLOAK
    IDENTITY & ORG --> REDIS

    PIPELINE --> REDPANDA
    NOTIFICATION --> REDPANDA
    PROJECT --> REDPANDA

    PIPELINE --> TEMPORAL
    TEMPORAL --> TEST_RUNNER
    TEST_RUNNER --> MINIO

    IDENTITY & ORG & PROJECT & PIPELINE & AI & NOTIFICATION --> OTEL
    OTEL --> LOKI & TEMPO & PROM
    LOKI & TEMPO & PROM --> GRAFANA
```

## Взаимодействие сервисов

```mermaid
flowchart LR
    subgraph Внешние Git
        GH[GitHub]
        GL[GitLab]
        BB[Bitbucket]
    end

    subgraph Ядро платформы
        ID[Identity]
        ORG[Organization]
        PRJ[Project]
        PIP[Pipeline]
        AI[AI Service]
        NOT[Notification]
        TR[Test Runner]
    end

    GH & GL & BB -->|webhook| PRJ
    PRJ -->|project.webhook.received| PIP
    PIP -->|pipeline.trigger| TR
    TR -->|run.step.completed| PIP
    TR -->|run.completed| PIP
    PIP -->|run.finished| NOT
    PIP -->|run.finished| AI
    AI -->|generation.completed| NOT
    ORG -->|membership.requested| NOT
    ID -->|user.registered| ORG
```

## Потоки данных

### Поток тестового запуска

```mermaid
sequenceDiagram
    participant Git as Git Provider
    participant PRJ as Project Service
    participant PIP as Pipeline Service
    participant TMP as Temporal
    participant TR as Test Runner
    participant MINIO as MinIO
    participant NOT as Notification
    participant DASH as Dashboard

    Git->>PRJ: Webhook (push/PR)
    PRJ->>PIP: Событие: project.webhook.received
    PIP->>PIP: Найти подходящий pipeline
    PIP->>TMP: Запустить workflow
    TMP->>TR: testPipelineWorkflow
    TR->>TR: prepareRepository
    TR->>TR: Параллельно: unit, lint, sast, audit
    TR->>TR: Последовательно: e2e, load (условно)
    TR->>TR: collectCoverage
    TR->>MINIO: uploadArtifacts
    TR->>PIP: reportStepResult (x N)
    TR->>PIP: notifyRunCompleted
    PIP->>NOT: Событие: run.finished
    PIP->>DASH: SSE: обновление статуса
    NOT->>NOT: Отправка по каналам
```

## Технологический стек с обоснованиями

| Технология | Обоснование выбора |
|------------|-------------------|
| **TypeScript** | Единый язык для бэкенда, фронтенда и мобильного приложения. Статическая типизация снижает количество ошибок |
| **NestJS** | Модульная архитектура, встроенная DI, поддержка OpenAPI, гибкость транспортов (HTTP, Kafka, gRPC) |
| **Next.js 15** | Server Components, App Router, встроенная аутентификация (NextAuth v5), оптимальная производительность |
| **Expo** | Кроссплатформенная мобильная разработка с доступом к нативным API, OTA-обновления |
| **PostgreSQL 16** | Надёжная СУБД с поддержкой JSON, полнотекстового поиска, partitioning |
| **Prisma** | Типобезопасный ORM с автогенерацией клиента, удобные миграции |
| **Redis** | Низколатентное кэширование, хранилище сессий, pub/sub для real-time |
| **Redpanda** | Kafka-совместимый брокер без JVM-зависимости, низкая задержка, простое развёртывание |
| **Temporal** | Надёжная оркестрация долгоживущих процессов с автоматическим retry и восстановлением |
| **Keycloak** | Полнофункциональный IdP с поддержкой OAuth 2.0, OIDC, федерации идентификаторов |
| **MinIO** | S3-совместимое хранилище для артефактов тестирования (скриншоты, отчёты, видео) |
| **Traefik** | Динамическая конфигурация, автоматические TLS-сертификаты, middleware-цепочки |
| **Grafana Stack** | Комплексная наблюдаемость: Loki (логи), Tempo (трейсы), Prometheus (метрики) |
| **OpenTelemetry** | Вендор-нейтральный стандарт телеметрии, единый SDK для всех сервисов |
| **Terraform** | IaC для воспроизводимого развёртывания облачной инфраструктуры |
| **pgvector** | Хранение эмбеддингов и поиск по косинусному сходству для RAG базы знаний |
| **Turborepo** | Инкрементальные сборки, кэширование задач, параллельное выполнение в monorepo |

## Принципы проектирования

### 1. Database-per-Service

Каждый микросервис владеет своей базой данных PostgreSQL. Это обеспечивает:
- Независимое развёртывание и масштабирование сервисов
- Изоляцию данных и предотвращение связывания на уровне БД
- Возможность выбора оптимальной схемы для каждого контекста

```mermaid
graph LR
    subgraph Identity
        IS[Identity Service] --> PG1[(identity_db<br/>:5441)]
    end
    subgraph Organization
        OS[Org Service] --> PG2[(org_db<br/>:5434)]
    end
    subgraph Project
        PS[Project Service] --> PG3[(project_db<br/>:5437)]
    end
    subgraph Pipeline
        PPS[Pipeline Service] --> PG4[(pipeline_db<br/>:5438)]
    end
    subgraph AI
        AS[AI Service] --> PG5[(ai_db<br/>:5440)]
    end
    subgraph Notification
        NS[Notification Service] --> PG6[(notify_db<br/>:5439)]
    end
```

### 2. Event-Driven Architecture

Межсервисное взаимодействие осуществляется через события в Redpanda. Это обеспечивает:
- Слабую связанность между сервисами
- Возможность асинхронной обработки
- Устойчивость к временным отказам (гарантия доставки)
- Масштабирование через consumer groups

### 3. API Gateway Pattern

Traefik выступает единой точкой входа:
- Маршрутизация по PathPrefix (`/api/identity`, `/api/org`, и т.д.)
- Централизованный rate limiting
- JWT-валидация на уровне gateway
- Автоматическое TLS через Let's Encrypt
- Health checks для всех upstream-сервисов

### 4. Strangler Fig Pattern (для миграции)

Архитектура позволяет постепенно заменять или добавлять сервисы без влияния на остальную систему благодаря:
- Асинхронному взаимодействию через события
- API-версионированию
- Независимому развёртыванию

### 5. Observability by Design

Наблюдаемость встроена с первого дня:
- Распределённый трейсинг через OpenTelemetry
- Структурированное логирование в Loki
- Метрики приложений в Prometheus
- Централизованные дашборды в Grafana

### 6. Security in Depth

Многослойная модель безопасности:
- TLS на уровне API Gateway
- JWT-аутентификация с Keycloak
- RBAC на уровне организации (ADMIN/MEMBER/VIEWER)
- Rate limiting для защиты от DDoS
- Аудит действий через события
