# Test Runner Service — Сервис запуска тестов

## Общие сведения

| Параметр | Значение |
|----------|----------|
| **Назначение** | Выполнение тестовых шагов пайплайна через Temporal Workflows |
| **Интеграция** | Temporal Server (:7233) |
| **Тип** | Temporal Worker (без собственного HTTP API) |
| **Хранилище артефактов** | MinIO (S3-совместимое) |

Test Runner Service реализован как набор Temporal Workers, выполняющих Activities для различных типов тестирования. Сервис не имеет собственного HTTP API — вся координация происходит через Temporal.

## TestPipelineWorkflow

Основной workflow, оркестрирующий весь процесс тестирования.

```mermaid
flowchart TD
    START([Вход: runId, repoUrl,<br/>commitSha, steps]) --> NOTIFY_START

    NOTIFY_START[notifyRunStarted<br/>Уведомление о начале запуска] --> PREPARE

    PREPARE[prepareRepository<br/>Клонирование/fetch репозитория<br/>Checkout на commitSha] --> CLASSIFY

    CLASSIFY{Классификация шагов}

    CLASSIFY -->|Параллельные| PARALLEL
    CLASSIFY -->|Последовательные| SEQ_WAIT

    subgraph PARALLEL_PHASE [Параллельная фаза]
        PARALLEL[Promise.all]
        UNIT[runUnitTests<br/>Unit-тесты]
        LINT[runLinter<br/>Линтинг]
        SAST[runSAST<br/>Статический анализ<br/>безопасности]
        AUDIT[runDependencyAudit<br/>Аудит зависимостей]

        PARALLEL --> UNIT & LINT & SAST & AUDIT
    end

    UNIT & LINT & SAST & AUDIT --> CHECK_PARALLEL

    CHECK_PARALLEL{Есть ли провалы<br/>в параллельных шагах?}
    CHECK_PARALLEL -->|Да| MARK_FAILED[overallStatus = FAILED]
    CHECK_PARALLEL -->|Нет| SEQ_WAIT

    MARK_FAILED --> SEQ_WAIT

    SEQ_WAIT{Unit-тесты прошли?}

    SEQ_WAIT -->|Да| SEQ_PHASE
    SEQ_WAIT -->|Нет| SKIP_SEQ[Пропуск E2E/Load<br/>status = skipped]

    subgraph SEQ_PHASE [Последовательная фаза]
        E2E[runE2ETests /<br/>runPlaywrightTests<br/>E2E-тесты]
        LOAD[runLoadTests /<br/>runK6LoadTest<br/>Нагрузочное тестирование]
        DAST[runDAST<br/>Динамический анализ<br/>безопасности]

        E2E --> LOAD --> DAST
    end

    SKIP_SEQ --> COVERAGE
    SEQ_PHASE --> COVERAGE

    COVERAGE[collectCoverage<br/>Сбор отчёта о покрытии] --> COMPARE

    COMPARE[compareCoverage<br/>Сравнение с baseline] --> UPLOAD

    UPLOAD[uploadArtifacts<br/>Загрузка артефактов в MinIO<br/>Скриншоты, видео, отчёты] --> NOTIFY_DONE

    NOTIFY_DONE[notifyRunCompleted<br/>Уведомление о завершении] --> CLEANUP

    CLEANUP[cleanupRepository<br/>Очистка рабочей директории] --> END

    END([Конец workflow])

    style PARALLEL_PHASE fill:#e8f4f8,stroke:#4a9eff
    style SEQ_PHASE fill:#fef3e2,stroke:#f5a623
```

## Описание Activities

### Repository Activities

| Activity | Таймаут | Retry | Описание |
|----------|---------|-------|----------|
| `prepareRepository` | 5 мин | 3 попытки | Клонирование репозитория, checkout на commitSha |
| `cleanupRepository` | 5 мин | 3 попытки | Удаление рабочей директории |

### Test Runner Activities

| Activity | Таймаут | Retry | Heartbeat | Описание |
|----------|---------|-------|-----------|----------|
| `runUnitTests` | 30 мин | 2 попытки | 2 мин | Запуск unit-тестов (Jest/Vitest/Mocha) |
| `runLinter` | 30 мин | 2 попытки | 2 мин | Запуск линтера (ESLint/Prettier) |
| `runE2ETests` | 30 мин | 2 попытки | 2 мин | Запуск E2E-тестов (Cypress/Playwright) |
| `runLoadTests` | 30 мин | 2 попытки | 2 мин | Запуск нагрузочных тестов (k6/Artillery) |

### Security Activities

| Activity | Таймаут | Retry | Описание |
|----------|---------|-------|----------|
| `runSAST` | 15 мин | 2 попытки | Статический анализ безопасности (Semgrep) |
| `runDAST` | 15 мин | 2 попытки | Динамический анализ безопасности |
| `runDependencyAudit` | 15 мин | 2 попытки | Аудит зависимостей (npm audit/Snyk) |

### E2E Activities

| Activity | Таймаут | Retry | Heartbeat | Описание |
|----------|---------|-------|-----------|----------|
| `runPlaywrightTests` | 30 мин | 2 попытки | 2 мин | Запуск Playwright тестов с браузерами |

### Coverage Activities

| Activity | Таймаут | Retry | Описание |
|----------|---------|-------|----------|
| `collectCoverage` | 5 мин | 3 попытки | Сбор данных покрытия (Istanbul/c8) |
| `compareCoverage` | 5 мин | 3 попытки | Сравнение с baseline покрытия |

### Artifact Activities

| Activity | Таймаут | Retry | Описание |
|----------|---------|-------|----------|
| `uploadArtifact` | 10 мин | 3 попытки | Загрузка одного файла в MinIO |
| `uploadDirectory` | 10 мин | 3 попытки | Загрузка директории в MinIO |

### Reporting Activities

| Activity | Таймаут | Retry | Описание |
|----------|---------|-------|----------|
| `reportStepResult` | 1 мин | 5 попыток | Отправка результата шага в Pipeline Service |
| `notifyRunStarted` | 1 мин | 5 попыток | Уведомление о начале запуска |
| `notifyRunCompleted` | 1 мин | 5 попыток | Уведомление о завершении запуска |

### Load Test Activities

| Activity | Таймаут | Retry | Heartbeat | Описание |
|----------|---------|-------|-----------|----------|
| `runK6LoadTest` | 30 мин | 2 попытки | 2 мин | Запуск k6 нагрузочного тестирования |

## Архитектура пулов воркеров

```mermaid
flowchart TD
    TEMPORAL[Temporal Server] --> TQ1[Task Queue:<br/>compute-pool]
    TEMPORAL --> TQ2[Task Queue:<br/>browser-pool]
    TEMPORAL --> TQ3[Task Queue:<br/>security-pool]

    subgraph COMPUTE [Compute Pool]
        W1[Worker 1<br/>unit, lint, coverage]
        W2[Worker 2<br/>unit, lint, coverage]
        W3[Worker N<br/>unit, lint, coverage]
    end

    subgraph BROWSER [Browser Pool]
        BW1[Worker 1<br/>e2e, playwright<br/>+ Chromium/Firefox]
        BW2[Worker 2<br/>e2e, playwright<br/>+ Chromium/Firefox]
    end

    subgraph SECURITY [Security Pool]
        SW1[Worker 1<br/>sast, dast, audit]
        SW2[Worker 2<br/>sast, dast, audit]
    end

    TQ1 --> COMPUTE
    TQ2 --> BROWSER
    TQ3 --> SECURITY

    style COMPUTE fill:#e8f4f8,stroke:#4a9eff
    style BROWSER fill:#fef3e2,stroke:#f5a623
    style SECURITY fill:#fde8e8,stroke:#ff6b6b
```

### Характеристики пулов

| Пул | Task Queue | Типы проверок | Требования | Масштабирование |
|-----|-----------|---------------|-----------|----------------|
| **Compute** | `compute-pool` | unit, lint, coverage, load | CPU, RAM | Горизонтальное (по нагрузке) |
| **Browser** | `browser-pool` | e2e, playwright_e2e | CPU, RAM, браузеры (Chromium, Firefox) | Ограниченное (ресурсоёмко) |
| **Security** | `security-pool` | sast, dast, dep_audit | CPU, инструменты безопасности | Горизонтальное |

## Обработка ошибок

### Стратегия устойчивости

1. **safeRunStep** — обёртка, перехватывающая ошибки отдельных шагов, чтобы провал одного шага не крашил весь workflow
2. **Best-effort reporting** — если отправка результата шага не удалась, workflow продолжает выполнение
3. **Best-effort artifacts** — ошибки загрузки артефактов не прерывают workflow
4. **Cleanup в finally** — рабочая директория очищается в любом случае

### Условия пропуска шагов

| Условие | Действие |
|---------|----------|
| Unit-тесты провалены | E2E и Playwright тесты пропускаются (status: skipped) |
| Activity выбросила исключение | Шаг помечается как `errored`, workflow продолжается |
| Coverage отключена в config | Фаза сбора покрытия пропускается |

## Загрузка артефактов в MinIO

```mermaid
flowchart TD
    RESULTS[Результаты шагов] --> CHECK{Есть скриншоты<br/>или видео?}

    CHECK -->|Да| UPLOAD_MEDIA[Загрузка в MinIO<br/>runs/:runId/:checkType/screenshots/<br/>runs/:runId/:checkType/videos/]
    CHECK -->|Нет| CHECK_COV

    UPLOAD_MEDIA --> CHECK_COV{Coverage<br/>собрана?}

    CHECK_COV -->|Да| UPLOAD_COV[Загрузка директории coverage<br/>runs/:runId/coverage/]
    CHECK_COV -->|Нет| DONE

    UPLOAD_COV --> DONE[Список URL артефактов]

    style UPLOAD_MEDIA fill:#4a9eff,color:#fff
    style UPLOAD_COV fill:#4a9eff,color:#fff
```

### Структура хранения в MinIO

```
test-artifacts/
└── runs/
    └── {runId}/
        ├── unit/
        │   └── screenshots/
        ├── e2e/
        │   ├── screenshots/
        │   └── videos/
        ├── playwright_e2e/
        │   ├── screenshots/
        │   └── videos/
        └── coverage/
            ├── index.html
            ├── lcov.info
            └── ...
```
