# Справочник API

## Обзор

Все API-сервисы доступны через Traefik API Gateway по единому домену. В режиме разработки каждый сервис доступен напрямую по своему порту.

| Сервис | Прямой URL | Gateway маршрут |
|--------|-----------|----------------|
| Identity | `http://localhost:3001` | `/api/identity` |
| Organization | `http://localhost:3002` | `/api/org` |
| Project | `http://localhost:3003` | `/api/project` |
| Pipeline | `http://localhost:3004` | `/api/pipeline` |
| AI | `http://localhost:3005` | `/api/ai` |
| Notification | `http://localhost:3006` | `/api/notifications` |

## Аутентификация

Все защищённые эндпоинты требуют заголовок:

```
Authorization: Bearer <access_token>
```

Access token получается через эндпоинты `/auth/login` или `/auth/register`.

## Сводная таблица эндпоинтов

### Identity Service (порт 3001)

| Метод | Путь | Авторизация | Описание |
|-------|------|-------------|----------|
| `POST` | `/auth/register` | Публичный | Регистрация нового пользователя |
| `POST` | `/auth/login` | Публичный | Вход по email/password |
| `POST` | `/auth/refresh` | Публичный | Обновление пары токенов |
| `POST` | `/auth/logout` | Bearer JWT | Выход и отзыв refresh token |
| `GET` | `/auth/me` | Bearer JWT | Получение текущего пользователя |
| `POST` | `/api/v1/users/batch` | Внутренний (`@Public()`) | Получение пользователей по массиву ID |

### Organization Service (порт 3002)

| Метод | Путь | Авторизация | Роль | Описание |
|-------|------|-------------|------|----------|
| `POST` | `/organizations/:orgId/members/invite` | Bearer JWT | ADMIN | Пригласить участника |
| `GET` | `/organizations/:orgId/members` | Bearer JWT | Любой | Список участников |
| `PATCH` | `/organizations/:orgId/members/:memberId/approve` | Bearer JWT | ADMIN | Одобрить приглашение |
| `PATCH` | `/organizations/:orgId/members/:memberId/reject` | Bearer JWT | ADMIN | Отклонить приглашение |
| `PATCH` | `/organizations/:orgId/members/:memberId/role` | Bearer JWT | ADMIN | Изменить роль |
| `DELETE` | `/organizations/:orgId/members/:memberId` | Bearer JWT | ADMIN | Удалить участника |

### Project Service (порт 3003)

| Метод | Путь | Авторизация | Описание |
|-------|------|-------------|----------|
| `POST` | `/projects` | Bearer JWT | Создать проект |
| `GET` | `/projects?orgId=` | Bearer JWT | Список проектов организации |
| `GET` | `/projects/:id` | Bearer JWT | Получить проект по ID |
| `PATCH` | `/projects/:id` | Bearer JWT | Обновить проект |
| `DELETE` | `/projects/:id` | Bearer JWT | Мягкое удаление проекта |
| `POST` | `/projects/:id/webhook/connect` | Bearer JWT | Подключить webhook |
| `DELETE` | `/projects/:id/webhook/disconnect` | Bearer JWT | Отключить webhook |

### Pipeline Service (порт 3004)

| Метод | Путь | Авторизация | Описание |
|-------|------|-------------|----------|
| `POST` | `/pipelines` | Bearer JWT | Создать пайплайн |
| `GET` | `/pipelines?projectId=` | Bearer JWT | Список пайплайнов |
| `GET` | `/pipelines/:id` | Bearer JWT | Получить пайплайн по ID |
| `PATCH` | `/pipelines/:id` | Bearer JWT | Обновить пайплайн |
| `DELETE` | `/pipelines/:id` | Bearer JWT | Удалить пайплайн |
| `POST` | `/pipelines/:id/toggle` | Bearer JWT | Включить/выключить |
| `POST` | `/test-runs` | Bearer JWT | Создать тестовый запуск |
| `GET` | `/test-runs?pipelineId=` | Bearer JWT | Список запусков по пайплайну |
| `GET` | `/test-runs/:id` | Bearer JWT | Получить запуск с результатами |
| `POST` | `/test-runs/:id/cancel` | Bearer JWT | Отменить запуск |
| `GET` | `/checklists/:id/items/:itemId/messages` | Bearer JWT | Сообщения AI-чата для пункта чек-листа |
| `POST` | `/checklists/:id/items/:itemId/messages` | Bearer JWT | Отправить сообщение в AI-чат пункта чек-листа |

### AI Service (порт 3005)

| Метод | Путь | Авторизация | Описание |
|-------|------|-------------|----------|
| `POST` | `/ai/generate` | Bearer JWT | Запустить ИИ-генерацию |
| `GET` | `/ai/generations?projectId=&type=` | Bearer JWT | Список генераций |
| `GET` | `/ai/generations/stats?projectId=` | Bearer JWT | Статистика генераций |
| `GET` | `/ai/generations/:id` | Bearer JWT | Детали генерации |
| `PATCH` | `/ai/generations/:id/feedback` | Bearer JWT | Обратная связь |
| `POST` | `/ai/chat` | Bearer JWT | Отправить сообщение в чат (SSE поток) |
| `GET` | `/ai/chat/conversations?projectId=` | Bearer JWT | Список бесед |
| `GET` | `/ai/chat/conversations/:id` | Bearer JWT | Получить беседу с сообщениями |
| `DELETE` | `/ai/chat/conversations/:id` | Bearer JWT | Удалить беседу |
| `POST` | `/ai/knowledge/index` | Bearer JWT | Переиндексация документации |
| `GET` | `/ai/knowledge/search?q=&projectId=` | Bearer JWT | Поиск по базе знаний |

### Notification Service (порт 3006)

| Метод | Путь | Авторизация | Описание |
|-------|------|-------------|----------|
| `POST` | `/notifications/configs` | Bearer JWT | Создать конфигурацию |
| `GET` | `/notifications/configs?orgId=` | Bearer JWT | Список конфигураций |
| `GET` | `/notifications/configs/:id` | Bearer JWT | Получить конфигурацию |
| `PATCH` | `/notifications/configs/:id` | Bearer JWT | Обновить конфигурацию |
| `DELETE` | `/notifications/configs/:id` | Bearer JWT | Удалить конфигурацию |

## Общие форматы ответов

### Успешный ответ (единичный объект)

```json
{
  "id": "clu1234567890",
  "email": "user@example.com",
  "name": "User Name",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

### Успешный ответ (список)

```json
[
  { "id": "...", "name": "..." },
  { "id": "...", "name": "..." }
]
```

### Ответ аутентификации

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "clref_abc123...",
  "user": {
    "id": "clu1234567890",
    "email": "user@example.com",
    "name": "User Name",
    "avatarUrl": null
  }
}
```

## Коды ошибок

| HTTP код | Описание | Типичные причины |
|----------|----------|-----------------|
| `400` | Bad Request | Невалидные данные в теле запроса |
| `401` | Unauthorized | Отсутствующий или невалидный JWT |
| `403` | Forbidden | Недостаточные права (роль) |
| `404` | Not Found | Ресурс не найден |
| `409` | Conflict | Дублирование (email, membership, repo URL) |
| `422` | Unprocessable Entity | Семантическая ошибка валидации |
| `429` | Too Many Requests | Превышен rate limit |
| `500` | Internal Server Error | Внутренняя ошибка сервера |

### Формат ошибки

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

### Ошибка валидации (400)

```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "password must be at least 8 characters"
  ],
  "error": "Bad Request"
}
```

## Формат пагинации

Для эндпоинтов, возвращающих списки, поддерживаются query-параметры пагинации:

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|-------------|----------|
| `page` | `number` | `1` | Номер страницы |
| `limit` | `number` | `20` | Количество записей на страницу |
| `sortBy` | `string` | `createdAt` | Поле для сортировки |
| `sortOrder` | `string` | `desc` | Направление сортировки (`asc` / `desc`) |

### Пример запроса с пагинацией

```
GET /test-runs?pipelineId=abc-123&page=2&limit=10&sortBy=createdAt&sortOrder=desc
```

## Swagger/OpenAPI

Каждый сервис предоставляет Swagger UI для интерактивной документации API:

| Сервис | Swagger URL |
|--------|------------|
| Identity | http://localhost:3001/api/docs |
| Organization | http://localhost:3002/api/docs |
| Project | http://localhost:3003/api/docs |
| Pipeline | http://localhost:3004/api/docs |
| AI | http://localhost:3005/api/docs |
| Notification | http://localhost:3006/api/docs |
