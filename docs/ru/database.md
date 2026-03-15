# Архитектура баз данных

## Паттерн Database-per-Service

Каждый микросервис владеет собственной базой данных PostgreSQL 16. Это обеспечивает:

- **Изоляцию данных** — сервисы не могут обращаться к таблицам друг друга напрямую
- **Независимое масштабирование** — каждая БД может быть оптимизирована отдельно
- **Автономность развёртывания** — миграции применяются независимо
- **Устойчивость** — проблема в одной БД не влияет на другие сервисы

```mermaid
graph LR
    subgraph Identity
        IS[Identity Service<br/>:3001] --> PG1[(identity_db<br/>:5441)]
    end
    subgraph Organization
        OS[Organization Service<br/>:3002] --> PG2[(org_db<br/>:5434)]
    end
    subgraph Project
        PS[Project Service<br/>:3003] --> PG3[(project_db<br/>:5437)]
    end
    subgraph Pipeline
        PPS[Pipeline Service<br/>:3004] --> PG4[(pipeline_db<br/>:5438)]
    end
    subgraph AI
        AS[AI Service<br/>:3005] --> PG5[(ai_db<br/>:5440)]
    end
    subgraph Notification
        NS[Notification Service<br/>:3006] --> PG6[(notify_db<br/>:5439)]
    end
    subgraph Keycloak
        KC[Keycloak<br/>:8180] --> PG7[(keycloak_db<br/>:5435)]
    end
    subgraph Temporal
        TMP[Temporal<br/>:7233] --> PG8[(temporal_db<br/>:5436)]
    end
```

## ER-диаграммы по сервисам

### Identity Service — identity_db

```mermaid
erDiagram
    users {
        string id PK "cuid()"
        string email UK "unique"
        string name
        string password_hash "nullable"
        string avatar_url "nullable"
        string keycloak_id UK "nullable, unique"
        datetime created_at
        datetime updated_at
        datetime deleted_at "nullable"
    }

    oauth_accounts {
        string id PK "cuid()"
        enum provider "GITHUB | GITLAB | BITBUCKET"
        string provider_user_id
        string access_token
        string refresh_token "nullable"
        datetime expires_at "nullable"
        string user_id FK
        datetime created_at
        datetime updated_at
        datetime deleted_at "nullable"
    }

    refresh_tokens {
        string id PK "cuid()"
        string token UK "unique"
        datetime expires_at
        datetime revoked_at "nullable"
        string user_id FK
        datetime created_at
    }

    users ||--o{ oauth_accounts : "has"
    users ||--o{ refresh_tokens : "has"
```

### Organization Service — org_db

```mermaid
erDiagram
    organizations {
        string id PK "cuid()"
        string name
        string slug UK "unique"
        enum plan "FREE | PRO | ENTERPRISE"
        datetime created_at
        datetime updated_at
        datetime deleted_at "nullable"
    }

    org_memberships {
        string id PK "cuid()"
        string user_id "внешняя ссылка"
        enum role "ADMIN | MEMBER | VIEWER"
        enum status "PENDING | APPROVED | REJECTED"
        datetime requested_at
        datetime resolved_at "nullable"
        string org_id FK
        datetime created_at
        datetime updated_at
        datetime deleted_at "nullable"
    }

    organizations ||--o{ org_memberships : "has"
```

### Project Service — project_db

```mermaid
erDiagram
    projects {
        string id PK "uuid()"
        string org_id "внешняя ссылка"
        string name
        string repo_url
        enum repo_provider "GITHUB | GITLAB | BITBUCKET"
        string repo_owner
        string repo_name
        string default_branch "default: main"
        string webhook_id "nullable"
        string webhook_secret "nullable"
        json settings "default: {}"
        datetime created_at
        datetime updated_at
        datetime deleted_at "nullable"
    }
```

### Pipeline Service — pipeline_db

```mermaid
erDiagram
    pipelines {
        string id PK "uuid()"
        string project_id "внешняя ссылка"
        string name
        enum trigger "PUSH | PULL_REQUEST | SCHEDULE | MANUAL"
        string cron_expr "nullable"
        json steps "default: []"
        boolean enabled "default: true"
        datetime created_at
        datetime updated_at
    }

    test_runs {
        string id PK "uuid()"
        string pipeline_id FK
        string commit_sha
        string branch
        enum status "QUEUED | RUNNING | PASSED | FAILED | ERRORED | CANCELLED"
        datetime started_at "nullable"
        datetime finished_at "nullable"
        string triggered_by "nullable"
        json metadata "default: {}"
        datetime created_at
    }

    test_results {
        string id PK "uuid()"
        string run_id FK
        enum check_type "UNIT | INTEGRATION | E2E | LOAD | LINT | SAST | DAST | DEPENDENCY_AUDIT | AI_REVIEW"
        enum status "PENDING | RUNNING | PASSED | FAILED | SKIPPED | CANCELLED"
        string summary
        json details "default: {}"
        string artifact_url "nullable"
        int duration_ms "default: 0"
        datetime created_at
    }

    coverage_snapshots {
        string id PK "uuid()"
        string result_id FK UK "unique"
        float line_pct
        float branch_pct
        float function_pct
        json uncovered "default: {}"
    }

    pipelines ||--o{ test_runs : "has"
    test_runs ||--o{ test_results : "has"
    test_results ||--o| coverage_snapshots : "has"
```

### AI Service — ai_db

```mermaid
erDiagram
    ai_generations {
        string id PK "uuid()"
        string project_id "внешняя ссылка"
        enum type "TEST_GEN | BUG_DETECT | FLAKY_DETECT | COVERAGE_ADVICE"
        json input_context
        text output
        string model
        int tokens_used "default: 0"
        boolean accepted "nullable"
        string feedback "nullable"
        datetime created_at
    }

    conversations {
        string id PK "uuid()"
        string project_id "внешняя ссылка"
        string title "nullable"
        datetime created_at
        datetime updated_at
    }

    chat_messages {
        string id PK "uuid()"
        string conversation_id FK
        string role "USER | ASSISTANT | SYSTEM | TOOL"
        text content
        json tool_calls "nullable"
        json tool_results "nullable"
        string model "nullable"
        int tokens_used "default: 0"
        datetime created_at
    }

    knowledge_chunks {
        string id PK "uuid()"
        string project_id "nullable, внешняя ссылка"
        string source
        text content
        vector embedding "pgvector"
        json metadata "nullable"
        datetime created_at
    }

    conversations ||--o{ chat_messages : "has"
```

### Notification Service — notify_db

```mermaid
erDiagram
    notification_configs {
        string id PK "uuid()"
        string org_id "внешняя ссылка"
        enum channel "EMAIL | SLACK | TELEGRAM | PUSH"
        string event
        json config "default: {}"
        boolean enabled "default: true"
        datetime created_at
        datetime updated_at
    }

    notification_logs {
        string id PK "uuid()"
        string config_id FK
        json payload
        enum status "PENDING | SENT | FAILED"
        string error "nullable"
        datetime sent_at "nullable"
        datetime created_at
    }

    notification_configs ||--o{ notification_logs : "has"
```

## Общая обзорная ER-диаграмма

```mermaid
erDiagram
    USER ||--o{ OAUTH_ACCOUNT : "has"
    USER ||--o{ REFRESH_TOKEN : "has"
    USER }o--o{ ORG_MEMBERSHIP : "participates"

    ORGANIZATION ||--o{ ORG_MEMBERSHIP : "has"
    ORGANIZATION ||--o{ PROJECT : "owns"
    ORGANIZATION ||--o{ NOTIFICATION_CONFIG : "configures"

    PROJECT ||--o{ PIPELINE : "has"
    PROJECT ||--o{ AI_GENERATION : "analyzed by"
    PROJECT ||--o{ CONVERSATION : "has"
    PROJECT ||--o{ KNOWLEDGE_CHUNK : "has"

    PIPELINE ||--o{ TEST_RUN : "triggers"

    TEST_RUN ||--o{ TEST_RESULT : "produces"

    TEST_RESULT ||--o| COVERAGE_SNAPSHOT : "may have"

    NOTIFICATION_CONFIG ||--o{ NOTIFICATION_LOG : "logs"
```

> **Примечание:** Связи между сервисами (например, Organization → Project) реализованы через хранение `orgId` / `projectId` как строковых полей, без foreign key на уровне БД. Целостность обеспечивается на уровне приложения и событий.

## Стратегия миграций

### Инструменты

Все миграции управляются через **Prisma Migrate**:

```bash
# Создание новой миграции
cd services/<service-name>
npx prisma migrate dev --name <migration-name>

# Применение миграций в production
npx prisma migrate deploy

# Генерация Prisma Client
npx prisma generate
```

### Правила миграций

| Правило | Описание |
|---------|----------|
| **Обратная совместимость** | Миграции не должны ломать текущую версию приложения |
| **Мягкое удаление** | Использование `deletedAt` вместо физического удаления |
| **Инкрементальность** | Каждая миграция — минимальное атомарное изменение |
| **Именование** | Формат: `YYYYMMDDHHMMSS_описание_на_английском` |
| **Тестирование** | Миграции тестируются на staging перед production |

### Процесс развёртывания миграций

```mermaid
flowchart LR
    DEV[Разработчик] -->|prisma migrate dev| LOCAL[(Локальная БД)]
    LOCAL -->|git push| REPO[Git Repository]
    REPO -->|CI/CD| STAGING[(Staging БД)]
    STAGING -->|Ручное подтверждение| PROD[(Production БД)]

    style DEV fill:#4a9eff,color:#fff
    style STAGING fill:#f5a623,color:#fff
    style PROD fill:#ff6b6b,color:#fff
```

### Индексы

Все модели используют индексы для оптимизации запросов:

| Сервис | Таблица | Индексы |
|--------|---------|---------|
| Identity | `users` | `email` (unique), `keycloak_id` (unique), `deleted_at` |
| Identity | `oauth_accounts` | `[provider, provider_user_id]` (unique), `user_id`, `deleted_at` |
| Identity | `refresh_tokens` | `token` (unique), `user_id` |
| Organization | `organizations` | `slug` (unique), `deleted_at` |
| Organization | `org_memberships` | `[user_id, org_id]` (unique), `org_id`, `user_id`, `deleted_at` |
| Project | `projects` | `[org_id, repo_url]` (unique), `org_id` |
| Pipeline | `pipelines` | `project_id` |
| Pipeline | `test_runs` | `pipeline_id`, `status` |
| Pipeline | `test_results` | `run_id` |
| Pipeline | `coverage_snapshots` | `result_id` (unique) |
| AI | `ai_generations` | `project_id`, `type` |
| Notification | `notification_configs` | `[org_id, channel, event]` (unique), `org_id` |
| Notification | `notification_logs` | `config_id`, `status` |
