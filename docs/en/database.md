# Database Architecture

## Database-per-Service Pattern

Each microservice owns and manages its own PostgreSQL database. No service directly queries another service's database. Cross-service data is obtained through API calls or event consumption.

```mermaid
graph TD
    subgraph Identity["Identity Service"]
        IS[Identity API] --> IDB[("identity_db<br/>:5441")]
    end

    subgraph Organization["Organization Service"]
        OS[Organization API] --> ODB[("org_db<br/>:5434")]
    end

    subgraph Project["Project Service"]
        PS[Project API] --> PDB[("project_db<br/>:5437")]
    end

    subgraph Pipeline["Pipeline Service"]
        PLS[Pipeline API] --> PLDB[("pipeline_db<br/>:5438")]
    end

    subgraph AI["AI Service"]
        AIS[AI API] --> AIDB[("ai_db<br/>:5440")]
    end

    subgraph Notification["Notification Service"]
        NS[Notification API] --> NDB[("notify_db<br/>:5439")]
    end

    subgraph Infrastructure
        KDB[("keycloak_db<br/>:5435")]
        TDB[("temporal_db<br/>:5436")]
    end
```

### Benefits

| Benefit | Description |
|---|---|
| **Independent evolution** | Each service can modify its schema without coordinating with other teams |
| **Fault isolation** | A database failure or corruption affects only the owning service |
| **Independent scaling** | Each database can be scaled (vertical or horizontal) based on its specific load patterns |
| **Technology freedom** | Services could theoretically use different database engines (though all currently use PostgreSQL) |
| **Security boundary** | Database credentials are scoped per service; no shared superuser |

### Trade-offs

| Trade-off | Mitigation |
|---|---|
| No cross-database joins | Services communicate via REST APIs or events |
| Eventual consistency | Redpanda events propagate state changes asynchronously |
| Data duplication | Acceptable for read-heavy denormalized data (e.g., user name cached in org membership) |
| Distributed transactions | Saga pattern via Temporal workflows |

## Entity-Relationship Diagrams

### Identity Service

```mermaid
erDiagram
    User {
        string id PK
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
        string email UK
        string name
        string passwordHash
        string avatarUrl
        string keycloakId UK
    }

    OAuthAccount {
        string id PK
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
        OAuthProvider provider
        string providerUserId
        string accessToken
        string refreshToken
        datetime expiresAt
        string userId FK
    }

    RefreshToken {
        string id PK
        datetime createdAt
        string token UK
        datetime expiresAt
        datetime revokedAt
        string userId FK
    }

    User ||--o{ OAuthAccount : "has many"
    User ||--o{ RefreshToken : "has many"
```

### Organization Service

```mermaid
erDiagram
    Organization {
        string id PK
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
        string name
        string slug UK
        OrgPlan plan
    }

    OrgMembership {
        string id PK
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
        string userId
        OrgMemberRole role
        OrgMemberStatus status
        datetime requestedAt
        datetime resolvedAt
        string orgId FK
    }

    Organization ||--o{ OrgMembership : "has many"
```

### Project Service

```mermaid
erDiagram
    Project {
        string id PK
        string orgId
        string name
        string repoUrl
        RepoProvider repoProvider
        string repoOwner
        string repoName
        string defaultBranch
        string webhookId
        string webhookSecret
        json settings
        datetime createdAt
        datetime updatedAt
        datetime deletedAt
    }
```

### Pipeline Service

```mermaid
erDiagram
    Pipeline {
        string id PK
        string projectId
        string name
        PipelineTrigger trigger
        string cronExpr
        json steps
        boolean enabled
        datetime createdAt
        datetime updatedAt
    }

    TestRun {
        string id PK
        string pipelineId FK
        string commitSha
        string branch
        TestRunStatus status
        datetime startedAt
        datetime finishedAt
        string triggeredBy
        json metadata
        datetime createdAt
    }

    TestResult {
        string id PK
        string runId FK
        TestCheckType checkType
        TestStatus status
        string summary
        json details
        string artifactUrl
        int durationMs
        datetime createdAt
    }

    CoverageSnapshot {
        string id PK
        string resultId FK UK
        float linePct
        float branchPct
        float functionPct
        json uncovered
    }

    Pipeline ||--o{ TestRun : "has many"
    TestRun ||--o{ TestResult : "has many"
    TestResult ||--o| CoverageSnapshot : "has one (optional)"
```

### AI Service

```mermaid
erDiagram
    AIGeneration {
        string id PK
        string projectId
        GenerationType type
        json inputContext
        string output
        string model
        int tokensUsed
        boolean accepted
        string feedback
        datetime createdAt
    }

    Conversation {
        string id PK
        string projectId
        string title
        datetime createdAt
        datetime updatedAt
    }

    ChatMessage {
        string id PK
        string conversationId FK
        string role
        string content
        json toolCalls
        json toolResults
        string model
        int tokensUsed
        datetime createdAt
    }

    KnowledgeChunk {
        string id PK
        string projectId
        string source
        string content
        vector embedding
        json metadata
        datetime createdAt
    }

    Conversation ||--o{ ChatMessage : "has many"
```

### Notification Service

```mermaid
erDiagram
    NotificationConfig {
        string id PK
        string orgId
        NotificationChannel channel
        string event
        json config
        boolean enabled
        datetime createdAt
        datetime updatedAt
    }

    NotificationLog {
        string id PK
        string configId FK
        json payload
        NotificationStatus status
        string error
        datetime sentAt
        datetime createdAt
    }

    NotificationConfig ||--o{ NotificationLog : "has many"
```

## Combined Overview

This diagram shows how entities relate conceptually across services. Note that these relationships are not enforced by foreign keys at the database level -- they are maintained through application logic, API calls, and events.

```mermaid
erDiagram
    User {
        string id PK
        string email
        string name
    }

    Organization {
        string id PK
        string name
        string slug
    }

    OrgMembership {
        string userId
        string orgId
        string role
    }

    Project {
        string id PK
        string orgId
        string name
        string repoUrl
    }

    Pipeline {
        string id PK
        string projectId
        string name
    }

    TestRun {
        string id PK
        string pipelineId
        string status
    }

    TestResult {
        string id PK
        string runId
        string checkType
    }

    CoverageSnapshot {
        string id PK
        string resultId
    }

    AIGeneration {
        string id PK
        string projectId
        string type
    }

    Conversation {
        string id PK
        string projectId
        string title
    }

    KnowledgeChunk {
        string id PK
        string projectId
        string source
    }

    NotificationConfig {
        string id PK
        string orgId
        string channel
    }

    User ||--o{ OrgMembership : "belongs to orgs"
    Organization ||--o{ OrgMembership : "has members"
    Organization ||--o{ Project : "has projects"
    Organization ||--o{ NotificationConfig : "has notification configs"
    Project ||--o{ Pipeline : "has pipelines"
    Project ||--o{ AIGeneration : "has AI generations"
    Project ||--o{ Conversation : "has conversations"
    Project ||--o{ KnowledgeChunk : "has knowledge"
    Pipeline ||--o{ TestRun : "has runs"
    TestRun ||--o{ TestResult : "has results"
    TestResult ||--o| CoverageSnapshot : "has coverage"
```

## Migration Strategy

### Prisma Migrations

Each service manages its own migrations using Prisma Migrate. Migrations are stored in each service's `prisma/migrations/` directory.

```bash
# Generate a new migration after schema changes
cd services/<service-name>
npx prisma migrate dev --name <migration-name>

# Apply migrations in production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Migration Best Practices

| Practice | Description |
|---|---|
| **Additive changes** | Prefer adding new columns/tables over modifying existing ones |
| **Nullable new columns** | New columns should be nullable or have defaults to avoid breaking existing data |
| **Separate schema and data** | Use Prisma for schema migrations, application code for data migrations |
| **Review before deploy** | Always review generated SQL before applying to staging/production |
| **Version control** | Migration files are committed to git alongside schema changes |

### Running All Migrations

From the repository root:

```bash
# Generate Prisma clients for all services
pnpm db:generate

# Run migrations for all services
pnpm db:migrate
```

These commands use Turborepo to run the corresponding Prisma commands across all services in parallel.
