# Pipeline Service

## Overview

| Property | Value |
|---|---|
| **Purpose** | Pipeline configuration, test run management, result tracking, coverage snapshots, checklist-based testing |
| **Port** | 3004 |
| **Database** | `pipeline_db` (PostgreSQL, port 5438) |
| **Framework** | NestJS |
| **Gateway Route** | `/api/pipeline/*` |

## Prisma Schema

```prisma
enum PipelineTrigger {
  PUSH
  PULL_REQUEST
  SCHEDULE
  MANUAL
}

enum TestRunStatus {
  QUEUED
  RUNNING
  PASSED
  FAILED
  ERRORED
  CANCELLED
}

enum TestCheckType {
  UNIT
  INTEGRATION
  E2E
  LOAD
  LINT
  SAST
  DAST
  DEPENDENCY_AUDIT
  AI_REVIEW
  REPOSITORY_SETUP
  COVERAGE
}

enum ChecklistItemPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum TestStatus {
  PENDING
  RUNNING
  PASSED
  FAILED
  SKIPPED
  CANCELLED
}

model Pipeline {
  id        String          @id @default(uuid())
  projectId String
  name      String
  trigger   PipelineTrigger
  cronExpr  String?
  steps     Json            @default("[]")
  enabled   Boolean         @default(true)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  runs      TestRun[]
}

model TestRun {
  id          String        @id @default(uuid())
  pipelineId  String
  commitSha   String
  branch      String
  status      TestRunStatus @default(QUEUED)
  startedAt   DateTime?
  finishedAt  DateTime?
  triggeredBy String?
  metadata    Json          @default("{}")
  createdAt   DateTime      @default(now())
  pipeline    Pipeline      @relation(fields: [pipelineId], references: [id])
  results     TestResult[]
}

model TestResult {
  id          String        @id @default(uuid())
  runId       String
  checkType   TestCheckType
  status      TestStatus    @default(PENDING)
  summary     String        @default("")
  details     Json          @default("{}")
  artifactUrl String?
  durationMs  Int           @default(0)
  createdAt   DateTime      @default(now())
  run         TestRun       @relation(fields: [runId], references: [id])
  coverage    CoverageSnapshot?
}

model Checklist {
  id          String          @id @default(uuid())
  projectId   String
  name        String
  description String          @default("")
  targetUrl   String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  items       ChecklistItem[]
  runs        ChecklistRun[]
}

model ChecklistItem {
  id                String                @id @default(uuid())
  checklistId       String
  title             String
  description       String                @default("")
  expectedBehavior  String                @default("")
  priority          ChecklistItemPriority @default(MEDIUM)
  order             Int                   @default(0)
  generatedTestCode String?               @db.Text
  checklist         Checklist             @relation(...)
  results           ChecklistItemResult[]
}

model ChecklistRun {
  id          String        @id @default(uuid())
  checklistId String
  targetUrl   String
  status      TestRunStatus @default(QUEUED)
  triggeredBy String?
  startedAt   DateTime?
  finishedAt  DateTime?
  metadata    Json          @default("{}")
  createdAt   DateTime      @default(now())
  checklist   Checklist     @relation(...)
  itemResults ChecklistItemResult[]
}

model ChecklistItemResult {
  id          String     @id @default(uuid())
  runId       String
  itemId      String
  status      TestStatus @default(PENDING)
  summary     String     @default("")
  details     Json       @default("{}")
  screenshots Json       @default("[]")
  durationMs  Int        @default(0)
  createdAt   DateTime   @default(now())
  run         ChecklistRun   @relation(...)
  item        ChecklistItem  @relation(...)
}

model CoverageSnapshot {
  id          String     @id @default(uuid())
  resultId    String     @unique
  linePct     Float
  branchPct   Float
  functionPct Float
  uncovered   Json       @default("{}")
  result      TestResult @relation(fields: [resultId], references: [id])
}
```

## API Endpoints

### Pipeline Endpoints

All endpoints require `Bearer JWT` authentication.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/pipelines` | Bearer JWT | Create a new pipeline |
| `GET` | `/pipelines?projectId=<id>` | Bearer JWT | List pipelines (optionally by project) |
| `GET` | `/pipelines/:id` | Bearer JWT | Get pipeline by ID (includes run count) |
| `PATCH` | `/pipelines/:id` | Bearer JWT | Update pipeline configuration |
| `DELETE` | `/pipelines/:id` | Bearer JWT | Delete a pipeline |
| `POST` | `/pipelines/:id/toggle` | Bearer JWT | Toggle pipeline enabled/disabled |

### Test Run Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/test-runs` | Bearer JWT | Create and trigger a new test run |
| `GET` | `/test-runs?pipelineId=<id>` | Bearer JWT | List test runs for a pipeline |
| `GET` | `/test-runs/:id` | Bearer JWT | Get test run with results |
| `POST` | `/test-runs/:id/cancel` | Bearer JWT | Cancel a running test run |

### Checklist Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/checklists` | Bearer JWT | Create a new checklist |
| `GET` | `/checklists?projectId=<id>` | Bearer JWT | List checklists by project |
| `GET` | `/checklists/:id` | Bearer JWT | Get checklist with items |
| `PATCH` | `/checklists/:id` | Bearer JWT | Update checklist |
| `DELETE` | `/checklists/:id` | Bearer JWT | Delete checklist |
| `POST` | `/checklists/:id/items` | Bearer JWT | Add item to checklist |
| `PATCH` | `/checklists/:id/items/:itemId` | Bearer JWT | Update checklist item |
| `DELETE` | `/checklists/:id/items/:itemId` | Bearer JWT | Delete checklist item |
| `POST` | `/checklists/:id/items/reorder` | Bearer JWT | Reorder checklist items |
| `POST` | `/checklists/:id/export` | Bearer JWT | Export checklist as JSON |
| `POST` | `/checklists/import` | Bearer JWT | Import checklist from JSON |
| `POST` | `/checklists/:id/run` | Bearer JWT | Trigger checklist execution |
| `GET` | `/checklist-runs/:runId` | Bearer JWT | Get checklist run with item results |

### Checklist Import/Export Format

```json
{
  "version": "1.0",
  "name": "Login Flow Tests",
  "description": "End-to-end tests for authentication",
  "targetUrl": "https://myapp.example.com",
  "items": [
    {
      "title": "User can login with valid credentials",
      "description": "Enter email and password, click submit",
      "expectedBehavior": "User is redirected to dashboard",
      "priority": "CRITICAL",
      "generatedTestCode": "import { test, expect } from '@playwright/test'; ..."
    }
  ]
}
```

## Pipeline Trigger Flow

```mermaid
flowchart TD
    subgraph Triggers
        Webhook["Webhook Event<br/>(push / PR)"]
        Schedule["Cron Schedule"]
        Manual["Manual Trigger<br/>(Dashboard / API)"]
    end

    subgraph Pipeline Service
        Receive["Receive trigger event"]
        FindPipeline["Find matching Pipeline<br/>by projectId + trigger type"]
        CreateRun["Create TestRun<br/>(status: QUEUED)"]
        EmitEvent["Emit 'run.started'<br/>to Redpanda"]
        StartWorkflow["Start Temporal Workflow<br/>(testPipelineWorkflow)"]
    end

    subgraph Temporal
        Workflow["TestPipeline Workflow"]
    end

    subgraph Results
        StepResult["Receive step results<br/>via reporting activities"]
        UpdateRun["Update TestRun status"]
        SaveResults["Save TestResult records"]
        SaveCoverage["Save CoverageSnapshot"]
        EmitComplete["Emit 'run.finished'<br/>to Redpanda"]
    end

    Webhook --> Receive
    Schedule --> Receive
    Manual --> Receive
    Receive --> FindPipeline
    FindPipeline --> CreateRun
    CreateRun --> EmitEvent
    EmitEvent --> StartWorkflow
    StartWorkflow --> Workflow
    Workflow --> StepResult
    StepResult --> UpdateRun
    StepResult --> SaveResults
    SaveResults --> SaveCoverage
    UpdateRun --> EmitComplete
```

## SSE Real-Time Updates

The Pipeline Service provides Server-Sent Events (SSE) for real-time test run progress monitoring.

```mermaid
sequenceDiagram
    participant Dashboard
    participant PipelineService as Pipeline Service
    participant Temporal
    participant Redpanda

    Dashboard->>PipelineService: GET /test-runs/:id/events<br/>(SSE connection)
    PipelineService-->>Dashboard: event: connected<br/>data: {runId}

    loop Each step completes
        Temporal->>PipelineService: Report step result
        PipelineService->>PipelineService: Update TestResult in DB
        PipelineService-->>Dashboard: event: step.completed<br/>data: {checkType, status, durationMs}
    end

    Temporal->>PipelineService: Report coverage
    PipelineService-->>Dashboard: event: coverage.updated<br/>data: {linePct, branchPct, functionPct}

    Temporal->>PipelineService: Workflow completed
    PipelineService->>PipelineService: Update TestRun status
    PipelineService->>Redpanda: Emit "run.finished"
    PipelineService-->>Dashboard: event: run.finished<br/>data: {status: PASSED/FAILED}
    PipelineService-->>Dashboard: (close connection)
```

## TestRun State Machine

```mermaid
stateDiagram-v2
    [*] --> QUEUED: Test run created

    QUEUED --> RUNNING: Temporal workflow starts
    QUEUED --> CANCELLED: User cancels

    RUNNING --> PASSED: All steps passed
    RUNNING --> FAILED: One or more steps failed
    RUNNING --> ERRORED: Workflow error / infrastructure failure
    RUNNING --> CANCELLED: User cancels

    PASSED --> [*]
    FAILED --> [*]
    ERRORED --> [*]
    CANCELLED --> [*]
```

### Status Descriptions

| Status | Description |
|---|---|
| `QUEUED` | Test run created, waiting for Temporal worker to pick it up |
| `RUNNING` | Temporal workflow is actively executing steps |
| `PASSED` | All configured steps completed successfully |
| `FAILED` | One or more steps reported a failure |
| `ERRORED` | Unexpected workflow or infrastructure error |
| `CANCELLED` | User or system cancelled the run before completion |

## Pipeline Configuration (steps JSON)

The `steps` field on the Pipeline model is a JSON array defining which checks to run and in what order:

```json
[
  { "checkType": "lint", "order": 1, "config": {} },
  { "checkType": "unit", "order": 2, "config": { "coverage": true } },
  { "checkType": "sast", "order": 3, "config": {} },
  { "checkType": "dep_audit", "order": 4, "config": {} },
  { "checkType": "e2e", "order": 5, "config": { "browser": "chromium" } },
  { "checkType": "load", "order": 6, "config": { "vus": 50, "duration": "5m" } }
]
```

### Available Check Types

| Check Type | Category | Description |
|---|---|---|
| `unit` | Testing | Unit tests (Jest, Vitest, etc.) |
| `e2e` | Testing | End-to-end tests (Cypress, Playwright) |
| `playwright_e2e` | Testing | Playwright-specific E2E tests |
| `load` | Performance | Load tests (generic) |
| `k6_load` | Performance | k6-based load tests |
| `lint` | Quality | Linting (ESLint, etc.) |
| `sast` | Security | Static Application Security Testing |
| `dast` | Security | Dynamic Application Security Testing |
| `dep_audit` | Security | Dependency vulnerability audit |
| `coverage` | Quality | Code coverage collection and reporting |
| `repository_setup` | Setup | Repository clone and dependency install |

## Checklist-Based Testing

Checklists provide a structured way to define, generate, and execute test scenarios against a live application.

### Workflow

1. **Create Checklist** — manually add test items or AI-generate from app description/URL
2. **Generate Tests** — AI generates Playwright E2E test code for each checklist item
3. **Run Checklist** — execute all items against a target URL via Temporal workflow
4. **Review Results** — each item shows PASSED/FAILED with screenshots and output

### Execution Flow

```mermaid
flowchart TD
    Create["Create Checklist<br/>(manual or AI-generated)"] --> Generate["Generate Playwright Tests<br/>(per item, via AI)"]
    Generate --> Run["Trigger Run<br/>(provide target URL)"]
    Run --> Temporal["Temporal: checklistRunWorkflow"]
    Temporal --> Loop["For each item:"]
    Loop --> Write["Write test to temp file"]
    Write --> Execute["npx playwright test"]
    Execute --> Report["Report result + screenshots"]
    Report --> Loop
    Loop --> Complete["Run completed<br/>(PASSED / FAILED)"]
```
