# Мастер генерации тестов с помощью AI — Техническая документация

## Обзор

Мастер генерации тестов с помощью AI — это многоэтапная функция оркестрации, которая анализирует Git-репозиторий, предлагает тестовые файлы через LLM, генерирует код тестов, валидирует его локально (tsc + eslint) и коммитит результаты обратно в репозиторий. Функция охватывает AI-сервис (NestJS), сервис организаций (токены провайдеров), сервис проектов (метаданные репозитория) и Next.js-дашборд (интерфейс мастера).

## Архитектура

```
 Dashboard (Next.js 15)               AI Service (NestJS :3005)
 ========================             ===============================
 test-wizard/ page                    TestGenSessionController
   |                                    |
   | REST + JWT Bearer                  v
   +------------------------------> TestGenSessionService (оркестратор)
                                        |
                        +---------------+----------------+------------------+
                        |               |                |                  |
                  ProjectAnalyzer  TestProposer     TestGenerator     LocalValidator
                  Service          Service          Service (LangGraph) Service
                        |               |                |                  |
                        v               v                v                  v
                   ProjectAnalyzer  TestProposer    TestGenerator     shell: git clone
                   Agent            Agent           Agent               tsc, eslint
                   (gpt-4.1-mini)   (o3)            (o3 + gpt-4.1-mini)
                        |               |                |
                        +-------+-------+----------------+
                                |
                                v
                          GitAdapterFactory
                           |       |        |
                        GitHub   GitLab  Bitbucket
                        Adapter  Adapter  Adapter
                                |
                                v
                     Organization Service (:3002)
                     /api/v1/provider-tokens
                                |
                                v
                       Project Service (:3003)
                       /api/v1/projects/:id
```

## Структура модулей

```
services/ai/src/
  test-gen-session/
    test-gen-session.module.ts          # NestJS-модуль (импортирует AgentsModule, GitAdapterModule)
    test-gen-session.controller.ts      # REST-эндпоинты под /ai/test-gen-sessions
    test-gen-session.service.ts         # Оркестратор: жизненный цикл сессии, координация шагов
    test-gen-session.repository.ts      # Prisma CRUD для TestGenSession
    project-profile.repository.ts       # Prisma CRUD для ProjectProfile
    local-validator.service.ts          # Клонирование репозитория, запуск tsc + eslint, отчёт об ошибках
    test-cleanup.util.ts                # Пост-обработка: удаление неиспользуемых импортов/переменных, исправление типов
    validation-error-parser.util.ts     # Парсинг вывода tsc/eslint в структурированные ошибки
    dto/
      start-session.dto.ts             # DTO запросов (StartSession, Approve, Commit и др.)
  git-adapter/
    git-adapter.interface.ts            # Интерфейс GitAdapter + типы данных
    git-adapter.factory.ts              # Фабрика: создаёт адаптер по провайдеру с использованием токена организации
    github.adapter.ts                   # Реализация GitHub REST API v3
    gitlab.adapter.ts                   # Реализация GitLab API
    bitbucket.adapter.ts                # Реализация Bitbucket API
    git-adapter.module.ts               # NestJS-модуль, экспортирующий GitAdapterFactory
  agents/
    base-agent.ts                       # Абстрактная база: настраивает ChatOpenAI (model + fastModel)
    types.ts                            # Все интерфейсы ввода/вывода агентов
    project-analyzer/
      project-analyzer.agent.ts         # LLM-вызов: дерево файлов + конфиги -> ProjectProfile JSON
      project-analyzer.service.ts       # NestJS-обёртка
    test-proposer/
      test-proposer.agent.ts            # LLM-вызов: исходные файлы + профиль -> TestProposal JSON
      test-proposer.service.ts          # NestJS-обёртка
    test-generator/
      test-generator.agent.ts           # LangGraph: analyze -> generate -> validate -> refine -> format
      test-generator.service.ts         # NestJS-обёртка (run + runFast)
```

## Схема базы данных

Все таблицы находятся в `ai_db` (PostgreSQL на порту 5440).

### TestGenSession

| Столбец           | Тип                   | Описание                                           |
|-------------------|-----------------------|----------------------------------------------------|
| id                | UUID (PK)             | Идентификатор сессии                               |
| project_id        | String                | FK на проект (в сервисе проектов)                  |
| status            | TestGenSessionStatus  | Текущее состояние (см. машину состояний ниже)      |
| profile_id        | UUID (nullable)       | FK на ProjectProfile                               |
| proposal          | JSON (nullable)       | Объект TestProposal от агента-предложителя         |
| approved_items    | JSON (nullable)       | Подмножество пунктов предложения, одобренных пользователем |
| generated_tests   | JSON (nullable)       | Массив `{ path, content }` сгенерированных тестов  |
| branch_name       | String (nullable)     | Git-ветка, созданная для коммита                   |
| commit_sha        | String (nullable)     | SHA коммита после пуша                             |
| commit_url        | String (nullable)     | URL для просмотра коммита                          |
| pull_request_url  | String (nullable)     | URL PR, если пользователь выбрал создание          |
| total_tokens_used | Int (default 0)       | Общее количество использованных токенов LLM        |
| metadata          | JSON (nullable)       | Информация о прогрессе: `{ phase, currentTest, totalTests }` |
| error             | String (nullable)     | Сообщение об ошибке при сбое                       |
| created_at        | DateTime              | Время создания сессии                              |
| updated_at        | DateTime              | Время последнего обновления                        |

Индексы: `project_id`, `status`.

### ProjectProfile

| Столбец         | Тип                 | Описание                                         |
|-----------------|---------------------|--------------------------------------------------|
| id              | UUID (PK)           | Идентификатор профиля                            |
| project_id      | String (unique)     | Один профиль на проект                           |
| language        | String              | Основной язык (typescript, python и т.д.)        |
| test_framework  | String              | Обнаруженный фреймворк (jest, vitest, pytest...) |
| package_manager | String (nullable)   | npm, pnpm, yarn, pip, maven и т.д.               |
| structure       | JSON                | `{ sourceDirectories, testDirectories, configFiles, totalFiles }` |
| test_patterns   | JSON (nullable)     | `{ filePattern, existingTests, estimatedCoverage }` |
| dependencies    | JSON (nullable)     | `{ runtime, devDependencies, testRelated }`      |
| analyzed_at     | DateTime            | Когда был выполнен последний анализ              |
| created_at      | DateTime            | Время создания профиля                           |
| updated_at      | DateTime            | Время последнего обновления                      |

Индекс: `project_id`.

## Машина состояний сессии

```
  START
    |
    v
 ANALYZING ──────────────────────────> FAILED
    |                                    ^
    v                                    |
 PROPOSING ──────────────────────────> FAILED
    |                                    ^
    v                                    |
 AWAITING_APPROVAL                       |
    |                                    |
    v                                    |
 GENERATING ─────────────────────────> FAILED
    |                                    ^
    v                                    |
 VALIDATING ─────────────────────────> FAILED
    |         |                          ^
    |  (skip) |                          |
    v         v                          |
 REVIEW <-----+                          |
    |                                    |
    +----> COMMITTING ────────────────> FAILED
              |
              v
           COMMITTED

 Любое нетерминальное состояние ──> CANCELLED
```

**Описание статусов:**

| Статус              | Значение                                                        |
|---------------------|-----------------------------------------------------------------|
| `ANALYZING`         | Сканирование дерева файлов и конфигурационных файлов, запуск агента ProjectAnalyzer |
| `PROPOSING`         | Агент TestProposer анализирует исходные файлы                   |
| `AWAITING_APPROVAL` | Предложение готово; ожидание выбора пользователя                |
| `GENERATING`        | Агент TestGenerator создаёт код тестов для каждого одобренного пункта |
| `VALIDATING`        | Локальный валидатор: клонирование, установка зависимостей, tsc, eslint |
| `REVIEW`            | Тесты готовы для проверки и редактирования пользователем        |
| `COMMITTING`        | Создание ветки и коммит файлов через API Git-провайдера         |
| `COMMITTED`         | Ветка создана, коммит отправлен, опционально создан PR          |
| `CANCELLED`         | Пользователь отменил сессию                                     |
| `FAILED`            | Невосстановимая ошибка на любом этапе                           |

## Справочник API

Все эндпоинты защищены `@UseGuards(JwtAuthGuard)` и требуют JWT Bearer-токен.

Базовый путь: `/ai/test-gen-sessions`

### POST / — Создание сессии

Создаёт новую сессию и запускает анализ проекта в фоновом режиме.

**Тело запроса:**
```json
{
  "projectId": "uuid",
  "locale": "en"           // опционально, для локализованного вывода
}
```

**Ответ:** `201 Created`
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "status": "ANALYZING",
  "createdAt": "2026-03-18T...",
  "updatedAt": "2026-03-18T..."
}
```

Анализ выполняется асинхронно. Опрашивайте `GET /:id`, пока статус не изменится на `PROPOSING`.

### GET / — Список сессий

**Параметры запроса:** `projectId` (обязательный)

**Ответ:** `200 OK` — Массив до 20 сессий, новейшие первые.

### GET /:id — Получение сессии

**Ответ:** `200 OK` — Полный объект сессии, включая `proposal`, `generatedTests`, `metadata` и т.д.

### GET /profile/:projectId — Получение профиля проекта

Возвращает кэшированный `ProjectProfile` для проекта (создаётся при анализе).

**Ответ:** `200 OK`
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "language": "typescript",
  "testFramework": "jest",
  "packageManager": "pnpm",
  "structure": { "sourceDirectories": ["src"], "testDirectories": ["src/__tests__"], ... },
  "testPatterns": { "filePattern": "*.spec.ts", "existingTests": [...], ... },
  "dependencies": { "runtime": [...], "devDependencies": [...], "testRelated": [...] }
}
```

### POST /:id/propose — Генерация предложения

Запускает агента TestProposer. Сессия должна быть в статусе `PROPOSING` (после анализа).

**Тело запроса:**
```json
{
  "focusArea": "модуль аутентификации",   // опционально
  "locale": "ru"                           // опционально
}
```

**Ответ:** `200 OK` — Объект `TestProposal`:
```json
{
  "items": [
    {
      "id": "test-1",
      "targetFile": "src/auth/auth.service.ts",
      "testFilePath": "src/auth/__tests__/auth.service.spec.ts",
      "testType": "unit",
      "description": "Тестирование потока аутентификации, включая валидацию токенов...",
      "rationale": "Критическая бизнес-логика без существующих тестов",
      "priority": "high",
      "estimatedTests": 8
    }
  ],
  "summary": "Предложено 5 тестовых файлов, покрывающих...",
  "estimatedTokens": 12000
}
```

Сессия переходит в `AWAITING_APPROVAL`.

### POST /:id/approve — Одобрение пунктов предложения

Пользователь выбирает, какие предложенные пункты генерировать.

**Тело запроса:**
```json
{
  "approvedItemIds": ["test-1", "test-3", "test-5"]
}
```

**Ответ:** `200 OK`
```json
{
  "approvedCount": 3
}
```

Сессия переходит в `GENERATING`.

### POST /:id/generate — Запуск генерации тестов

Запускает фоновую генерацию для всех одобренных пунктов. Возвращает ответ немедленно.

**Ответ:** `200 OK`
```json
{
  "status": "GENERATING",
  "sessionId": "uuid"
}
```

Опрашивайте `GET /:id` для отслеживания прогресса через `metadata.currentTest`, `metadata.totalTests`, `metadata.phase`.

### POST /:id/regenerate — Перегенерация отдельных тестов

Перегенерирует конкретные пункты из сессии в статусе `REVIEW`, `COMMITTED` или `AWAITING_APPROVAL`.

**Тело запроса:**
```json
{
  "itemIds": ["test-2"]
}
```

**Ответ:** `200 OK`
```json
{
  "status": "GENERATING",
  "sessionId": "uuid",
  "itemCount": 1
}
```

Существующие тесты для остальных пунктов сохраняются. Перегенерируются и объединяются только указанные пункты.

### PATCH /:id/tests — Обновление тестов

Пользователь редактирует содержимое тестов в статусе `REVIEW`.

**Тело запроса:**
```json
{
  "tests": [
    { "path": "src/__tests__/auth.service.spec.ts", "content": "import ..." }
  ]
}
```

**Ответ:** `200 OK` — Обновлённый массив тестов.

### POST /:id/skip-validation — Пропуск валидации

Доступен в статусах `VALIDATING` или `GENERATING`. Переводит сессию напрямую в `REVIEW`.

**Ответ:** `200 OK`
```json
{
  "status": "REVIEW",
  "sessionId": "uuid"
}
```

### POST /:id/cancel — Отмена сессии

Отменяет сессию из любого нетерминального статуса.

**Ответ:** `200 OK`
```json
{
  "status": "CANCELLED",
  "sessionId": "uuid"
}
```

### POST /:id/commit — Коммит тестов

Создаёт ветку, коммитит тестовые файлы, опционально создаёт пулл-реквест. Сессия должна быть в статусе `REVIEW`.

**Тело запроса:**
```json
{
  "createPR": true,                                       // опционально, по умолчанию false
  "commitMessage": "test: add unit tests for auth module" // опционально, генерируется автоматически
}
```

**Ответ:** `200 OK`
```json
{
  "branchName": "ai/test-gen-1710763200000",
  "commitSha": "abc123...",
  "commitUrl": "https://github.com/org/repo/commit/abc123",
  "pullRequestUrl": "https://github.com/org/repo/pull/42"
}
```

## Эндпоинты токенов провайдеров (Сервис организаций)

Эти эндпоинты находятся в сервисе организаций (порт 3002) и используются для хранения учётных данных Git-провайдеров.

| Метод  | Путь | Аутентификация | Описание |
|--------|------|----------------|----------|
| POST   | `/organizations/:orgId/provider-tokens` | JWT | Сохранить токен провайдера (`{ provider: "GITHUB", token: "ghp_..." }`) |
| GET    | `/organizations/:orgId/provider-tokens` | JWT | Список настроенных провайдеров (токены замаскированы) |
| DELETE | `/organizations/:orgId/provider-tokens/:provider` | JWT | Удалить токен провайдера |
| GET    | `/api/v1/provider-tokens?orgId=&provider=` | Внутренний (без аутентификации) | Межсервисное получение токена, возвращает `{ token }` |

## Интерфейс Git-адаптера

Все три адаптера провайдеров (GitHub, GitLab, Bitbucket) реализуют:

```typescript
interface GitAdapter {
  getFileTree(owner, repo, branch, pathPrefix?): Promise<FileTreeEntry[]>;
  getFileContent(owner, repo, branch, filePath): Promise<FileContent>;
  getMultipleFiles(owner, repo, branch, filePaths): Promise<FileContent[]>;
  getDiff(owner, repo, base, head): Promise<DiffEntry[]>;
  createBranch(owner, repo, branchName, fromRef): Promise<void>;
  commitFiles(owner, repo, branch, files, message): Promise<CommitResult>;
  createPullRequest(owner, repo, title, body, head, base): Promise<PullRequestResult>;
}
```

**Типы данных:**

```typescript
interface FileTreeEntry { path: string; type: 'file' | 'dir'; size?: number; }
interface FileContent   { path: string; content: string; encoding: string; size: number; }
interface CommitFile     { path: string; content: string; }
interface CommitResult   { sha: string; url: string; message: string; }
interface PullRequestResult { number: number; url: string; title: string; }
interface DiffEntry      { filename: string; status: 'added'|'modified'|'removed'|'renamed'; additions: number; deletions: number; patch?: string; }
```

**Поведение фабрики:**

`GitAdapterFactory.createForOrg(provider, orgId)` получает зашифрованный токен из сервиса организаций через внутренний эндпоинт, затем создаёт соответствующий адаптер. Если токен не настроен, выбрасывает `BadRequestException` с понятным сообщением, направляющим администратора в настройки организации.

**Особенности адаптера GitHub:**
- Использует GitHub REST API v3 с `Bearer`-аутентификацией и `X-GitHub-Api-Version: 2022-11-28`
- `getFileTree` использует `git/trees?recursive=1`; фильтрует `node_modules/`, `.git/`, `dist/`, `build/` и др.
- `getMultipleFiles` загружает параллельными пакетами по 5 с `Promise.allSettled`
- `commitFiles` использует низкоуровневый Git Data API (создание блобов, создание дерева, создание коммита, обновление ссылки)
- Обрабатывает усечённые деревья для больших репозиториев с предупреждающим логом

## Поток локальной валидации

После генерации тестов сервис выполняет локальную валидацию для обнаружения ошибок TypeScript и ESLint перед показом пользователю.

```
1. Клонирование репозитория (shallow, --depth=1) во временную директорию
   - URL аутентификации формируется по провайдеру: GITHUB — x-access-token, GITLAB — oauth2, BITBUCKET — x-token-auth
2. Установка зависимостей (frozen lockfile, --ignore-scripts)
   - Определяет пакетный менеджер по lockfile (pnpm-lock.yaml / yarn.lock / package-lock.json)
   - Откатывается к установке без lockfile при сбое frozen-установки
   - Обработка монорепозитория: находит ближайший package.json для каждого тестового файла, устанавливает зависимости по пакетам
3. Копирование сгенерированных тестовых файлов в клонированный репозиторий
4. Запуск `npx tsc --noEmit` по директории пакета
   - Парсинг вывода: "file(line,col): error TS####: message"
   - Фильтрация только ошибок в сгенерированных тестовых файлах
5. Запуск `npx eslint --format json` по директории пакета
   - Запускается только при наличии конфигурации ESLint
   - Парсинг JSON-вывода, фильтрация severity >= 2 (только ошибки)
6. Если обнаружены ошибки и попыток < 3:
   - Группировка ошибок по файлам
   - Форматирование ошибок в промпт для LLM с контекстом строк
   - Вызов TestGenerator.generateFast() для создания исправленного кода
   - Очистка исправленного кода (удаление markdown-разметки, запуск пайплайна очистки)
   - Повтор с шага 4
7. После 3 попыток или при успешной валидации: переход в REVIEW
```

Временная директория всегда очищается в блоке `finally`.

## Пайплайн пост-обработки тестового кода

`cleanGeneratedTest()` выполняет следующие проходы по порядку:

1. **`fixCommonTypeIssues`** — Замена `NodeJS.ProcessEnv` на `Record<string, string | undefined>`; удаление директив `@ts-expect-error` и `@ts-ignore`; добавление `/// <reference types="node" />` при наличии ссылок на `NodeJS`.
2. **`cleanUnusedImports`** — Парсинг всех операторов `import` (включая многострочные), проверка каждого импортированного имени на использование в теле кода, полное удаление неиспользуемых импортов, перестройка частично неиспользуемых импортов только с используемыми именами.
3. **`cleanUnusedVariables`** — Поиск объявлений `const`/`let`, где имя переменной больше нигде не встречается в файле; удаление их (пропуск общих тестовых глобалов: `module`, `app`, `describe` и т.д.).
4. **Схлопывание пустых строк** — Замена 3+ последовательных переносов строк на 2.

Дополнительно `fixImportPaths()` запускается после генерации для исправления относительных путей импортов с использованием предвычисленной карты `sourceFile -> correctRelativeImport`.

## Используемые LLM-модели

| Агент             | Модель                                     | Назначение                     |
|-------------------|--------------------------------------------|--------------------------------|
| ProjectAnalyzer   | `OPENAI_MODEL_FAST` (gpt-4.1-mini)         | Анализ структуры репозитория   |
| TestProposer      | `OPENAI_MODEL_ADVANCED` (o3)               | Предложение тестов с обоснованием |
| TestGenerator     | `OPENAI_MODEL_ADVANCED` (o3)               | Генерация кода тестов          |
| TestGenerator (validate) | `OPENAI_MODEL_FAST` (gpt-4.1-mini)  | Валидация сгенерированных тестов |
| Исправление валидации | `OPENAI_MODEL_FAST` через generateFast() | Исправление ошибок tsc/eslint  |
| LLM-проверка      | `OPENAI_MODEL_FAST` через generateFast()   | Пост-генерация: исправление импортов/типов |

Класс `BaseAgent` настраивает обе модели. Для моделей серии `o3` (reasoning) температура не задаётся (не поддерживается). Для `gpt-4.1-mini` температура — 0.1.

**Машина состояний LangGraph для TestGeneratorAgent:**

```
Полный режим:   START -> analyzeCode -> generateTests -> validateTests -+-> formatOutput -> END
                                                           ^             |
                                                           |   (refine)  |
                                                           +-- refineTests <-+
                                                           (макс. 1 уточнение)

Быстрый режим:  START -> analyzeCode -> generateTests -> formatOutput -> END
```

Мастер использует **быстрый режим** (`generateFast`) для пакетной генерации, затем запускает отдельный проход LLM-валидации и локальную валидацию. Полный режим (со встроенным циклом validate/refine) используется для генерации одиночных тестов через другие функции.

## Обработка ошибок

- **Сбои агентов**: Перехватываются в сервисе, сессия помечается как `FAILED` с сообщением об ошибке в столбце `error`.
- **Асинхронная генерация**: `generateApprovedTests` и `analyzeProject` выполняются в фоне (fire-and-forget с `.catch`). Ошибки логируются и сессия обновляется до `FAILED`.
- **Проверка отмены**: Во время цикла генерации каждая итерация проверяет, не был ли статус изменён на `CANCELLED` перед продолжением.
- **Откат валидации**: Если инфраструктура локальной валидации полностью отказывает (например, сбой git clone), сервис логирует предупреждение и переходит к `REVIEW` с `metadata.phase = 'validation_skipped'`.
- **Ошибки Git-адаптера**: `GitAdapterFactory` выбрасывает `BadRequestException` с понятными сообщениями (например, «Токен GITHUB не настроен для этой организации. Попросите администратора добавить его в Настройки организации -> Интеграции.»).

## Конфигурация (переменные окружения)

| Переменная                | Значение по умолчанию                           | Описание                                 |
|---------------------------|-------------------------------------------------|------------------------------------------|
| `PORT`                    | `3005`                                          | HTTP-порт AI-сервиса                     |
| `DATABASE_URL`            | `postgresql://postgres:postgres@localhost:5440/ai_db` | Строка подключения к БД AI          |
| `JWT_SECRET`              | (обязательно)                                   | Должен совпадать со всеми другими сервисами |
| `OPENAI_API_KEY`          | (обязательно)                                   | API-ключ OpenAI                          |
| `OPENAI_MODEL_FAST`       | `gpt-4.1-mini`                                  | Быстрая модель для анализа/валидации     |
| `OPENAI_MODEL_ADVANCED`   | `o3`                                            | Продвинутая модель для генерации         |
| `PROJECT_SERVICE_URL`     | `http://localhost:3003`                         | Внутренний URL сервиса проектов          |
| `ORGANIZATION_SERVICE_URL`| `http://localhost:3002`                         | Внутренний URL сервиса организаций       |
| `GITLAB_URL`              | `https://gitlab.com`                            | Базовый URL для self-hosted GitLab       |
| `KAFKA_BROKERS`           | `localhost:9092`                                | Адрес брокера Kafka/Redpanda             |
| `DASHBOARD_URL`           | `http://localhost:4200`                         | URL дашборда (для ссылок в PR и т.д.)    |

## Вопросы безопасности

1. **Токены провайдеров**: Хранятся в базе данных сервиса организаций. Получаются через внутренний эндпоинт (`/api/v1/provider-tokens`) без JWT-аутентификации — этот эндпоинт не должен быть доступен извне. AI-сервис никогда не сохраняет токены; он запрашивает их по требованию для каждой операции.

2. **Области действия токенов**: Токены GitHub требуют область `repo` (чтение дерева файлов, чтение содержимого, создание ветки, пуш коммитов, создание PR). Токены GitLab требуют область `api`. Токены Bitbucket требуют права на чтение/запись репозитория.

3. **JWT-аутентификация**: Все эндпоинты мастера используют `JwtAuthGuard`. Дашборд передаёт JWT сессии из NextAuth.

4. **Изоляция локальной валидации**: Репозитории клонируются во временные директории ОС с `--depth=1`. Зависимости устанавливаются с `--ignore-scripts` для предотвращения выполнения произвольного кода. Временные директории очищаются в блоках `finally`.

5. **Токен в URL клонирования**: Токены аутентификации встраиваются в URL клонирования (например, `https://x-access-token:TOKEN@github.com/...`). Эти URL существуют только в памяти во время фазы валидации и не сохраняются.

6. **Передача исходного кода**: AI-сервис отправляет содержимое исходных файлов в API OpenAI для анализа и генерации. Это должно быть отражено в политике конфиденциальности платформы. Организации, работающие с чувствительным кодом, должны оценить этот поток данных.

7. **Ограничение скорости**: Встроенного ограничения скорости на эндпоинтах мастера нет. Загрузка файлов имеет пакетный параллелизм 5, исходные файлы ограничены 30 на предложение. Разрешение импортов ограничено 20 файлами.
