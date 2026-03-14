# Powiadomienia

## Przegląd

Notification Service zapewnia wielokanałowe dostarczanie powiadomień o zdarzeniach w systemie. Serwis działa na porcie **3006**.

## Kanały powiadomień

| Kanał | Opis | Wymagana konfiguracja |
|-------|------|----------------------|
| **Email** | Powiadomienia emailowe | Serwer SMTP |
| **Slack** | Wiadomości na kanały Slack | Slack Bot Token |
| **Telegram** | Wiadomości przez bota Telegram | Telegram Bot Token |
| **Push** | Powiadomienia push do aplikacji mobilnej | Expo Push Token |

## Konfiguracja kanałów

### Email (SMTP)

Skonfiguruj w `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

### Slack

1. Utwórz aplikację Slack na https://api.slack.com/apps
2. Dodaj Bot Token Scopes: `chat:write`, `channels:read`
3. Zainstaluj aplikację w workspace
4. Skopiuj Bot Token

```env
SLACK_BOT_TOKEN=xoxb-your-token
```

### Telegram

1. Utwórz bota przez @BotFather w Telegramie
2. Uzyskaj token bota

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### Powiadomienia push

Powiadomienia push działają automatycznie przez Expo Push Service dla aplikacji mobilnej. Dodatkowa konfiguracja nie jest wymagana.

## Konfiguracja powiadomień

### Tworzenie konfiguracji

Konfiguracja powiadomień jest powiązana z organizacją i definiuje, które zdarzenia są wysyłane przez jakie kanały.

```http
POST /notifications/configs
Authorization: Bearer <token>
Content-Type: application/json

{
  "orgId": "uuid-organizacji",
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

### Zdarzenia

| Zdarzenie | Opis |
|-----------|------|
| `TEST_RUN_COMPLETED` | Przebieg testowy zakończony (pomyślnie) |
| `TEST_RUN_FAILED` | Przebieg testowy zakończony z błędami |
| `TEST_RUN_ERROR` | Błąd wykonania przebiegu |
| `PIPELINE_CREATED` | Utworzono nowy pipeline |
| `AI_GENERATION_COMPLETED` | Generowanie AI zakończone |
| `MEMBER_INVITED` | Zaproszono nowego członka |
| `MEMBER_JOINED` | Członek dołączył do organizacji |
| `COVERAGE_DECREASED` | Pokrycie kodu spadło |

### Zarządzanie konfiguracjami

#### Lista konfiguracji

```http
GET /notifications/configs?orgId=<id>
Authorization: Bearer <token>
```

#### Aktualizacja konfiguracji

```http
PATCH /notifications/configs/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "events": ["TEST_RUN_FAILED"],
  "enabled": true
}
```

#### Usunięcie konfiguracji

```http
DELETE /notifications/configs/:id
Authorization: Bearer <token>
```

## Przez Dashboard

1. Przejdź do organizacji → „Powiadomienia"
2. Kliknij „Nowa konfiguracja"
3. Wybierz kanał (Email, Slack, Telegram, Push)
4. Skonfiguruj parametry kanału
5. Wybierz zdarzenia do wysyłania
6. Zapisz konfigurację

## Architektura

Powiadomienia działają przez szynę zdarzeń (Redpanda):

1. Serwis źródłowy publikuje zdarzenie w Redpanda
2. Notification Service subskrybuje odpowiednie tematy
3. Po otrzymaniu zdarzenia sprawdzane są aktywne konfiguracje
4. Powiadomienie jest wysyłane przez skonfigurowane kanały

Zapewnia to asynchroniczne dostarczanie bez wpływu na wydajność głównych serwisów.
