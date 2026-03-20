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

Configure in the notification service `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

> **Tip:** For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password.

### Slack

1. Create a Slack app at https://api.slack.com/apps
2. Add Bot Token Scopes: `chat:write`
3. Install the app to your workspace
4. Copy the Bot Token (starts with `xoxb-`)
5. Invite the bot to the desired channel (`/invite @YourBotName`)

```env
SLACK_BOT_TOKEN=xoxb-your-token
```

When creating a notification config for Slack, specify the channel name (e.g., `#ci-results`).

### Telegram

1. Create a bot via @BotFather in Telegram
2. Get the bot token
3. Add the bot to your group/channel
4. Get the chat ID (you can use `https://api.telegram.org/bot<TOKEN>/getUpdates` after sending a message to the bot)

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

When creating a notification config for Telegram, specify the chat ID.

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
    "slackChannel": "#ci-results"
  },
  "events": [
    "run.finished",
    "run.failed"
  ],
  "enabled": true
}
```

**Channel-specific config fields:**

| Channel | Config field | Example |
|---------|-------------|---------|
| Email | `emails` | `{"emails": ["user@example.com"]}` |
| Slack | `slackChannel` | `{"slackChannel": "#ci-results"}` |
| Telegram | `chatId` | `{"chatId": "-1001234567890"}` |

### Events

| Event | Description |
|-------|-------------|
| `run.finished` | Test run completed |
| `run.failed` | Test run failed |
| `membership.requested` | Membership requested |

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
  "events": ["run.failed"],
  "enabled": true
}
```

#### Delete Configuration

```http
DELETE /notifications/configs/:id
Authorization: Bearer <token>
```

### Test Notification

Each notification config has a "Send test notification" button on the config card in the Dashboard. This sends a sample notification through the specific channel to verify that the configuration is working correctly.

```http
POST /notifications/configs/:id/test
Authorization: Bearer <token>
```

## Via Dashboard

1. Navigate to organization → "Notifications"
2. Click "New Configuration"
3. Select channel (Email, Slack, Telegram, Push)
4. Configure channel parameters:
   - **Email**: enter recipient email addresses
   - **Slack**: enter channel name (e.g., `#ci-results`)
   - **Telegram**: enter chat ID
5. Select events to subscribe to (e.g., `run.finished`, `run.failed`)
6. Save the configuration
7. Use the test notification button (arrow icon) on the config card to verify delivery

## Architecture

Notifications are delivered via direct HTTP calls between services:

1. When a relevant event occurs (e.g., a test run completes), the source service (Pipeline) sends an HTTP request to the Notification Service internal endpoint
2. The Notification Service looks up active configurations matching the organization and event type
3. Notifications are sent through all matching configured channels (Email, Slack, Telegram, Push)
4. Each delivery attempt is logged for auditability
