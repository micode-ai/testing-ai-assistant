# Уведомления

## Обзор

Notification Service обеспечивает мультиканальную отправку уведомлений о событиях в системе. Сервис работает на порту **3006**.

## Каналы уведомлений

| Канал | Описание | Требуемая конфигурация |
|-------|----------|----------------------|
| **Email** | Уведомления на электронную почту | SMTP-сервер |
| **Slack** | Сообщения в Slack-каналы | Slack Bot Token |
| **Telegram** | Сообщения через Telegram-бота | Telegram Bot Token |
| **Push** | Push-уведомления в мобильное приложение | Expo Push Token |

## Настройка каналов

### Email (SMTP)

Настройте в `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

### Slack

1. Создайте Slack-приложение на https://api.slack.com/apps
2. Добавьте Bot Token Scopes: `chat:write`, `channels:read`
3. Установите приложение в workspace
4. Скопируйте Bot Token

```env
SLACK_BOT_TOKEN=xoxb-your-token
```

### Telegram

1. Создайте бота через @BotFather в Telegram
2. Получите токен бота

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### Push-уведомления

Push-уведомления работают автоматически через Expo Push Service для мобильного приложения. Дополнительная настройка не требуется.

## Конфигурация уведомлений

### Создание конфигурации

Конфигурация уведомлений привязывается к организации и определяет, какие события и через какие каналы отправляются.

```http
POST /notifications/configs
Authorization: Bearer <token>
Content-Type: application/json

{
  "orgId": "uuid-организации",
  "channel": "SLACK",
  "config": {
    "channelId": "C01234567"
  },
  "events": [
    "TEST_RUN_COMPLETED",
    "TEST_RUN_FAILED",
    "AI_GENERATION_COMPLETED"
  ],
  "enabled": true
}
```

### События

| Событие | Описание |
|---------|----------|
| `TEST_RUN_COMPLETED` | Тестовый прогон завершён (успешно) |
| `TEST_RUN_FAILED` | Тестовый прогон завершён с ошибками |
| `TEST_RUN_ERROR` | Ошибка выполнения прогона |
| `PIPELINE_CREATED` | Создан новый пайплайн |
| `AI_GENERATION_COMPLETED` | AI-генерация завершена |
| `MEMBER_INVITED` | Приглашён новый участник |
| `MEMBER_JOINED` | Участник вступил в организацию |
| `COVERAGE_DECREASED` | Покрытие кода снизилось |

### Управление конфигурациями

#### Список конфигураций

```http
GET /notifications/configs?orgId=<id>
Authorization: Bearer <token>
```

#### Обновление конфигурации

```http
PATCH /notifications/configs/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "events": ["TEST_RUN_FAILED"],
  "enabled": true
}
```

#### Удаление конфигурации

```http
DELETE /notifications/configs/:id
Authorization: Bearer <token>
```

## Через Dashboard

1. Перейдите в организацию → «Уведомления»
2. Нажмите «Новая конфигурация»
3. Выберите канал (Email, Slack, Telegram, Push)
4. Настройте параметры канала
5. Выберите события для отправки
6. Сохраните конфигурацию

## Архитектура

Уведомления работают через событийную шину (Redpanda):

1. Сервис-источник публикует событие в Redpanda
2. Notification Service подписан на соответствующие топики
3. При получении события проверяются активные конфигурации
4. Уведомление отправляется через настроенные каналы

Это обеспечивает асинхронную доставку без влияния на производительность основных сервисов.
