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

Настройте в `.env` сервиса уведомлений:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

> **Совет:** Для Gmail используйте [пароль приложения](https://support.google.com/accounts/answer/185833) вместо обычного пароля.

### Slack

1. Создайте Slack-приложение на https://api.slack.com/apps
2. Добавьте Bot Token Scopes: `chat:write`
3. Установите приложение в workspace
4. Скопируйте Bot Token (начинается с `xoxb-`)
5. Пригласите бота в нужный канал (`/invite @ИмяБота`)

```env
SLACK_BOT_TOKEN=xoxb-your-token
```

При создании конфигурации для Slack укажите имя канала (например, `#ci-results`).

### Telegram

1. Создайте бота через @BotFather в Telegram
2. Получите токен бота
3. Добавьте бота в группу/канал
4. Получите chat ID (можно через `https://api.telegram.org/bot<TOKEN>/getUpdates` после отправки сообщения боту)

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

При создании конфигурации для Telegram укажите chat ID.

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
    "slackChannel": "#ci-results"
  },
  "events": [
    "run.finished",
    "run.failed"
  ],
  "enabled": true
}
```

**Поля конфигурации для каждого канала:**

| Канал | Поле конфигурации | Пример |
|-------|-------------------|--------|
| Email | `emails` | `{"emails": ["user@example.com"]}` |
| Slack | `slackChannel` | `{"slackChannel": "#ci-results"}` |
| Telegram | `chatId` | `{"chatId": "-1001234567890"}` |

### События

| Событие | Описание |
|---------|----------|
| `run.finished` | Тестовый прогон завершён |
| `run.failed` | Тестовый прогон завершён с ошибками |
| `membership.requested` | Запрос на членство в организации |

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
  "events": ["run.failed"],
  "enabled": true
}
```

#### Удаление конфигурации

```http
DELETE /notifications/configs/:id
Authorization: Bearer <token>
```

### Тестовое уведомление

На каждой карточке конфигурации в Dashboard есть кнопка «Отправить тестовое уведомление». Она отправляет пробное уведомление через указанный канал, чтобы проверить корректность настройки.

```http
POST /notifications/configs/:id/test
Authorization: Bearer <token>
```

## Через Dashboard

1. Перейдите в организацию → «Уведомления»
2. Нажмите «Новая конфигурация»
3. Выберите канал (Email, Slack, Telegram, Push)
4. Настройте параметры канала:
   - **Email**: введите адреса электронной почты получателей
   - **Slack**: введите имя канала (например, `#ci-results`)
   - **Telegram**: введите chat ID
5. Выберите события для подписки (например, `run.finished`, `run.failed`)
6. Сохраните конфигурацию
7. Используйте кнопку тестового уведомления (иконка стрелки) на карточке конфигурации для проверки доставки

## Архитектура

Уведомления доставляются через прямые HTTP-вызовы между сервисами:

1. При наступлении события (например, завершение тестового прогона) сервис-источник (Pipeline) отправляет HTTP-запрос на внутренний эндпоинт Notification Service
2. Notification Service ищет активные конфигурации, соответствующие организации и типу события
3. Уведомления отправляются через все подходящие настроенные каналы (Email, Slack, Telegram, Push)
4. Каждая попытка доставки логируется для аудита
