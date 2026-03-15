# API-справочник

## Общие сведения

Все API-эндпоинты используют REST и JSON. Аутентификация через JWT Bearer-токен.

**Заголовок авторизации:**
```
Authorization: Bearer <access_token>
```

**Базовые URL (локальная разработка):**
- Identity: `http://localhost:3001`
- Organization: `http://localhost:3002`
- Project: `http://localhost:3003`
- Pipeline: `http://localhost:3004`
- AI: `http://localhost:3005`
- Notification: `http://localhost:3006`

**Через API Gateway (продакшен):**
```
http://localhost/api/<service>
```

## Коды ответов

| Код | Описание |
|-----|----------|
| `200` | Успешный запрос |
| `201` | Ресурс создан |
| `400` | Неверный запрос (ошибки валидации) |
| `401` | Не аутентифицирован |
| `403` | Доступ запрещён |
| `404` | Ресурс не найден |
| `409` | Конфликт (дублирование) |
| `500` | Внутренняя ошибка сервера |

---

## Identity Service (порт 3001)

### Аутентификация

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/auth/register` | Регистрация нового пользователя |
| `POST` | `/auth/login` | Вход в систему |
| `POST` | `/auth/refresh` | Обновление access-токена |
| `POST` | `/auth/logout` | Выход из системы |
| `GET` | `/auth/me` | Получить текущего пользователя |

#### POST /auth/register

```json
// Запрос
{
  "name": "Иван Петров",
  "email": "ivan@example.com",
  "password": "securePassword123"
}

// Ответ 201
{
  "id": "uuid",
  "name": "Иван Петров",
  "email": "ivan@example.com",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

#### POST /auth/login

```json
// Запрос
{
  "email": "ivan@example.com",
  "password": "securePassword123"
}

// Ответ 200
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

#### POST /auth/refresh

```json
// Запрос
{
  "refreshToken": "eyJ..."
}

// Ответ 200
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

---

## Organization Service (порт 3002)

### Участники

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/organizations/:orgId/members/invite` | Пригласить участника |
| `GET` | `/organizations/:orgId/members` | Список участников |
| `PATCH` | `/organizations/:orgId/members/:id/approve` | Одобрить |
| `PATCH` | `/organizations/:orgId/members/:id/reject` | Отклонить |
| `PATCH` | `/organizations/:orgId/members/:id/role` | Изменить роль |
| `DELETE` | `/organizations/:orgId/members/:id` | Удалить участника |

#### POST /organizations/:orgId/members/invite

```json
// Запрос
{
  "email": "user@example.com",
  "role": "MEMBER"
}

// Ответ 201
{
  "id": "uuid",
  "userId": "uuid",
  "orgId": "uuid",
  "role": "MEMBER",
  "status": "PENDING"
}
```

---

## Project Service (порт 3003)

### Проекты

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/projects` | Создать проект |
| `GET` | `/projects?orgId=<id>` | Список проектов |
| `GET` | `/projects/:id` | Получить проект |
| `PATCH` | `/projects/:id` | Обновить проект |
| `DELETE` | `/projects/:id` | Удалить проект |
| `POST` | `/projects/:id/webhook/connect` | Подключить вебхук |
| `DELETE` | `/projects/:id/webhook/disconnect` | Отключить вебхук |

#### POST /projects

```json
// Запрос
{
  "name": "My Project",
  "description": "Описание проекта",
  "orgId": "uuid",
  "gitProvider": "GITHUB",
  "repoUrl": "https://github.com/org/repo",
  "defaultBranch": "main"
}

// Ответ 201
{
  "id": "uuid",
  "name": "My Project",
  "orgId": "uuid",
  "gitProvider": "GITHUB",
  "webhookConnected": false
}
```

---

## Pipeline Service (порт 3004)

### Пайплайны

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/pipelines` | Создать пайплайн |
| `GET` | `/pipelines?projectId=<id>` | Список пайплайнов |
| `GET` | `/pipelines/:id` | Получить пайплайн |
| `PATCH` | `/pipelines/:id` | Обновить пайплайн |
| `DELETE` | `/pipelines/:id` | Удалить пайплайн |
| `POST` | `/pipelines/:id/toggle` | Включить/отключить |

### Тестовые прогоны

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/test-runs` | Создать и запустить |
| `GET` | `/test-runs?pipelineId=<id>` | Список прогонов |
| `GET` | `/test-runs/:id` | Детали прогона |
| `POST` | `/test-runs/:id/cancel` | Отменить прогон |

#### POST /test-runs

```json
// Запрос
{
  "pipelineId": "uuid",
  "branch": "main",
  "commit": "abc123def"
}

// Ответ 201
{
  "id": "uuid",
  "pipelineId": "uuid",
  "status": "PENDING",
  "branch": "main",
  "commit": "abc123def",
  "createdAt": "2026-03-12T10:00:00Z"
}
```

---

## AI Service (порт 3005)

### AI-генерация

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/ai/generate` | Запустить генерацию |
| `GET` | `/ai/generations?projectId=<id>&type=<type>` | Список генераций |
| `GET` | `/ai/generations/:id` | Детали генерации |
| `PATCH` | `/ai/generations/:id/feedback` | Обратная связь |
| `GET` | `/ai/generations/stats?projectId=<id>` | Статистика |

### Чат

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/ai/chat` | Отправить сообщение в чат (SSE-поток) |
| `GET` | `/ai/chat/conversations?projectId=<id>` | Список диалогов |
| `GET` | `/ai/chat/conversations/:id` | Получить диалог с сообщениями |
| `DELETE` | `/ai/chat/conversations/:id` | Удалить диалог |

### База знаний

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/ai/knowledge/index` | Переиндексировать документацию в базу знаний |
| `GET` | `/ai/knowledge/search?q=<query>&projectId=<id>` | Поиск по базе знаний |

#### POST /ai/chat

```json
// Запрос
{
  "message": "Создай чек-лист для тестирования авторизации",
  "projectId": "uuid",
  "conversationId": "uuid-опционально"
}

// Ответ: SSE-поток
data: {"type":"text","content":"Я создам чек-лист...","conversationId":"uuid"}
data: {"type":"tool_call","content":"{\"name\":\"create_checklist\",\"args\":{...}}","conversationId":"uuid"}
data: {"type":"tool_result","content":"{\"name\":\"create_checklist\",\"result\":\"{...}\"}","conversationId":"uuid"}
data: {"type":"text","content":"Готово! Я создал...","conversationId":"uuid"}
data: {"type":"done","content":"","conversationId":"uuid"}
```

#### POST /ai/generate

```json
// Запрос
{
  "projectId": "uuid",
  "type": "TEST_GENERATION"
}

// Ответ 201
{
  "id": "uuid",
  "projectId": "uuid",
  "type": "TEST_GENERATION",
  "status": "PROCESSING",
  "createdAt": "2026-03-12T10:00:00Z"
}
```

---

## Notification Service (порт 3006)

### Конфигурации уведомлений

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/notifications/configs` | Создать конфигурацию |
| `GET` | `/notifications/configs?orgId=<id>` | Список конфигураций |
| `GET` | `/notifications/configs/:id` | Получить конфигурацию |
| `PATCH` | `/notifications/configs/:id` | Обновить конфигурацию |
| `DELETE` | `/notifications/configs/:id` | Удалить конфигурацию |

---

## Health Check (все сервисы)

```
GET /health → 200 OK
```
