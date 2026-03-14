# Notifications

## Overview

The Notification Service provides multi-channel notification delivery for system events. The service runs on port **3006**.

## Notification Channels

| Channel | Description | Required Configuration |
|---------|-------------|----------------------|
| **Email** | Email notifications | SMTP server |
| **Slack** | Messages to Slack channels | Slack Bot Token |
| **Telegram** | Messages via Telegram bot | Telegram Bot Token |
| **Push** | Push notifications to mobile app | Expo Push Token |

## Channel Setup

### Email (SMTP)

Configure in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

### Slack

1. Create a Slack app at https://api.slack.com/apps
2. Add Bot Token Scopes: `chat:write`, `channels:read`
3. Install the app to your workspace
4. Copy the Bot Token

```env
SLACK_BOT_TOKEN=xoxb-your-token
```

### Telegram

1. Create a bot via @BotFather in Telegram
2. Get the bot token

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### Push Notifications

Push notifications work automatically via Expo Push Service for the mobile app. No additional configuration required.

## Notification Configuration

### Creating a Configuration

A notification configuration is tied to an organization and defines which events are sent through which channels.

```http
POST /notifications/configs
Authorization: Bearer <token>
Content-Type: application/json

{
  "orgId": "org-uuid",
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

### Events

| Event | Description |
|-------|-------------|
| `TEST_RUN_COMPLETED` | Test run completed (successfully) |
| `TEST_RUN_FAILED` | Test run completed with failures |
| `TEST_RUN_ERROR` | Run execution error |
| `PIPELINE_CREATED` | New pipeline created |
| `AI_GENERATION_COMPLETED` | AI generation completed |
| `MEMBER_INVITED` | New member invited |
| `MEMBER_JOINED` | Member joined organization |
| `COVERAGE_DECREASED` | Code coverage decreased |

### Managing Configurations

#### List Configurations

```http
GET /notifications/configs?orgId=<id>
Authorization: Bearer <token>
```

#### Update Configuration

```http
PATCH /notifications/configs/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "events": ["TEST_RUN_FAILED"],
  "enabled": true
}
```

#### Delete Configuration

```http
DELETE /notifications/configs/:id
Authorization: Bearer <token>
```

## Via Dashboard

1. Navigate to organization → "Notifications"
2. Click "New Configuration"
3. Select channel (Email, Slack, Telegram, Push)
4. Configure channel parameters
5. Select events to send
6. Save the configuration

## Architecture

Notifications work through the event bus (Redpanda):

1. The source service publishes an event to Redpanda
2. Notification Service subscribes to relevant topics
3. Upon receiving an event, active configurations are checked
4. Notifications are sent through configured channels

This ensures asynchronous delivery without affecting core service performance.
