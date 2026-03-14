# Pipeline Service — Сервис пайплайнов

## Общие сведения

| Параметр | Значение |
|----------|----------|
| **Назначение** | Управление тестовыми пайплайнами, запуск тестов, сбор результатов, SSE-обновления |
| **Порт** | 3004 |
| **БД** | `pipeline_db` (PostgreSQL :5438) |
| **Фреймворк** | NestJS |
| **ORM** | Prisma |
| **Маршрут Gateway** | `/api/pipeline` |

## Prisma-схема

### Модели

```
Pipeline
├── id: String (uuid)
├── projectId: String
├── name: String
├── trigger: PipelineTrigger (PUSH | PULL_REQUEST | SCHEDULE | MANUAL)
├── cronExpr: String? (для SCHEDULE)
├── steps: Json (default: "[]")
├── enabled: Boolean (default: true)
├── createdAt / updatedAt
└── runs: TestRun[]

TestRun
├── id: String (uuid)
├── pipelineId → Pipeline
├── commitSha: String
├── branch: String
├── status: TestRunStatus (QUEUED | RUNNING | PASSED | FAILED | ERRORED | CANCELLED)
├── startedAt: DateTime?
├── finishedAt: DateTime?
├── triggeredBy: String?
├── metadata: Json
├── createdAt: DateTime
└── results: TestResult[]

TestResult
├── id: String (uuid)
├── runId → TestRun
├── checkType: TestCheckType
├── status: TestStatus (PENDING | RUNNING | PASSED | FAILED | SKIPPED | CANCELLED)
├── summary: String
├── details: Json
├── artifactUrl: String?
├── durationMs: Int
├── createdAt: DateTime
└── coverage: CoverageSnapshot?

CoverageSnapshot
├── id: String (uuid)
├── resultId → TestResult (unique)
├── linePct: Float
├── branchPct: Float
├── functionPct: Float
└── uncovered: Json
```

### Перечисления

| Enum | Значения |
|------|---------|
| `PipelineTrigger` | `PUSH`, `PULL_REQUEST`, `SCHEDULE`, `MANUAL` |
| `TestRunStatus` | `QUEUED`, `RUNNING`, `PASSED`, `FAILED`, `ERRORED`, `CANCELLED` |
| `TestCheckType` | `UNIT`, `INTEGRATION`, `E2E`, `LOAD`, `LINT`, `SAST`, `DAST`, `DEPENDENCY_AUDIT`, `AI_REVIEW` |
| `TestStatus` | `PENDING`, `RUNNING`, `PASSED`, `FAILED`, `SKIPPED`, `CANCELLED` |

## API-эндпоинты

### Pipelines

| Метод | Путь | Авторизация | Описание |
|-------|------|-------------|----------|
| `POST` | `/pipelines` | Bearer JWT | Создать пайплайн |
| `GET` | `/pipelines?projectId=` | Bearer JWT | Список пайплайнов (по проекту) |
| `GET` | `/pipelines/:id` | Bearer JWT | Получить пайплайн по ID |
| `PATCH` | `/pipelines/:id` | Bearer JWT | Обновить пайплайн |
| `DELETE` | `/pipelines/:id` | Bearer JWT | Удалить пайплайн |
| `POST` | `/pipelines/:id/toggle` | Bearer JWT | Включить/выключить пайплайн |

### Test Runs

| Метод | Путь | Авторизация | Описание |
|-------|------|-------------|----------|
| `POST` | `/test-runs` | Bearer JWT | Создать тестовый запуск |
| `GET` | `/test-runs?pipelineId=` | Bearer JWT | Список запусков по пайплайну |
| `GET` | `/test-runs/:id` | Bearer JWT | Получить запуск с результатами |
| `POST` | `/test-runs/:id/cancel` | Bearer JWT | Отменить запуск |

## Триггер пайплайна

```mermaid
flowchart TD
    A[Webhook от Git Provider] --> B[Project Service]
    B -->|project.webhook.received| C{Pipeline Service}

    C --> D{Найти пайплайны<br/>по projectId}
    D --> E{Для каждого pipeline}

    E --> F{Совпадает trigger?}
    F -->|PUSH + push event| G[Совпадение]
    F -->|PULL_REQUEST + PR event| G
    F -->|Не совпадает| H[Пропуск]

    G --> I{Pipeline enabled?}
    I -->|Нет| H
    I -->|Да| J[Создать TestRun<br/>status=QUEUED]

    J --> K[Отправить в Temporal<br/>testPipelineWorkflow]

    K --> L[Temporal Worker]
    L --> M[prepareRepository]
    M --> N[Параллельная фаза<br/>unit + lint + sast + audit]
    N --> O{Unit tests passed?}
    O -->|Да| P[Последовательная фаза<br/>e2e, load]
    O -->|Нет| Q[Пропуск e2e/load]

    P & Q --> R[collectCoverage]
    R --> S[uploadArtifacts → MinIO]
    S --> T[notifyRunCompleted]

    T --> U[Обновление TestRun<br/>status=PASSED/FAILED/ERRORED]
    U --> V[SSE → Dashboard]
    U --> W[Событие → Notification Service]
```

## SSE Real-Time обновления

Pipeline Service предоставляет Server-Sent Events (SSE) для real-time обновлений статусов тестовых запусков.

```mermaid
sequenceDiagram
    participant DASH as Dashboard
    participant PIP as Pipeline Service
    participant TR as Test Runner
    participant DB as pipeline_db

    DASH->>PIP: GET /test-runs/:id/events<br/>Accept: text/event-stream
    PIP-->>DASH: Connection established (SSE)

    loop Каждый шаг выполнения
        TR->>PIP: reportStepResult(runId, checkType, result)
        PIP->>DB: Создание TestResult
        PIP-->>DASH: event: step.completed<br/>data: {checkType, status, summary}
    end

    TR->>PIP: notifyRunCompleted(runId, status)
    PIP->>DB: Обновление TestRun.status
    PIP-->>DASH: event: run.completed<br/>data: {runId, status, duration}
    PIP-->>DASH: Connection closed
```

### Формат SSE-сообщений

```
event: step.completed
data: {"checkType":"unit","status":"passed","summary":"156 tests passed","durationMs":12450}

event: step.completed
data: {"checkType":"lint","status":"passed","summary":"No issues found","durationMs":3200}

event: run.completed
data: {"runId":"abc-123","status":"PASSED","finishedAt":"2025-01-15T10:30:00Z"}
```

## Машина состояний TestRun

```mermaid
stateDiagram-v2
    [*] --> QUEUED : Создание TestRun

    QUEUED --> RUNNING : Temporal Worker начал выполнение
    QUEUED --> CANCELLED : Пользователь отменил

    RUNNING --> PASSED : Все шаги пройдены
    RUNNING --> FAILED : Один или более шагов провалились
    RUNNING --> ERRORED : Ошибка инфраструктуры
    RUNNING --> CANCELLED : Пользователь отменил

    PASSED --> [*]
    FAILED --> [*]
    ERRORED --> [*]
    CANCELLED --> [*]
```

### Описание статусов

| Статус | Описание |
|--------|----------|
| `QUEUED` | Запуск создан, ожидает начала выполнения в Temporal |
| `RUNNING` | Temporal Worker выполняет шаги пайплайна |
| `PASSED` | Все шаги завершены успешно |
| `FAILED` | Один или более шагов провалены (тесты не прошли, линтер нашёл ошибки и т.д.) |
| `ERRORED` | Ошибка инфраструктуры (недоступен Git, ошибка Temporal и т.д.) |
| `CANCELLED` | Запуск отменён пользователем |

## Машина состояний TestResult

```mermaid
stateDiagram-v2
    [*] --> PENDING : Создание шага

    PENDING --> RUNNING : Шаг начал выполнение
    PENDING --> SKIPPED : Пропуск (зависимость провалена)
    PENDING --> CANCELLED : Запуск отменён

    RUNNING --> PASSED : Шаг пройден успешно
    RUNNING --> FAILED : Шаг провален
    RUNNING --> CANCELLED : Запуск отменён

    PASSED --> [*]
    FAILED --> [*]
    SKIPPED --> [*]
    CANCELLED --> [*]
```

## Конфигурация шагов пайплайна (steps)

Поле `steps` в модели Pipeline — это JSON-массив, определяющий последовательность шагов.

```json
[
  {
    "checkType": "unit",
    "order": 1,
    "config": {
      "framework": "jest",
      "coverage": true,
      "coverageThreshold": 80
    }
  },
  {
    "checkType": "lint",
    "order": 1,
    "config": {
      "tool": "eslint"
    }
  },
  {
    "checkType": "sast",
    "order": 1,
    "config": {
      "tool": "semgrep"
    }
  },
  {
    "checkType": "e2e",
    "order": 2,
    "config": {
      "framework": "playwright",
      "browsers": ["chromium", "firefox"]
    }
  }
]
```

Шаги с одинаковым `order` выполняются параллельно, с разным — последовательно.
