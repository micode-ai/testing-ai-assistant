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

Skonfiguruj w `.env` serwisu powiadomień:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

> **Wskazówka:** Dla Gmaila użyj [hasła aplikacji](https://support.google.com/accounts/answer/185833) zamiast zwykłego hasła.

### Slack

1. Utwórz aplikację Slack na https://api.slack.com/apps
2. Dodaj Bot Token Scopes: `chat:write`
3. Zainstaluj aplikację w workspace
4. Skopiuj Bot Token (zaczyna się od `xoxb-`)
5. Zaproś bota na wybrany kanał (`/invite @NazwaBota`)

```env
SLACK_BOT_TOKEN=xoxb-your-token
```

Podczas tworzenia konfiguracji dla Slacka podaj nazwę kanału (np. `#ci-results`).

### Telegram

1. Utwórz bota przez @BotFather w Telegramie
2. Uzyskaj token bota
3. Dodaj bota do grupy/kanału
4. Uzyskaj chat ID (możesz użyć `https://api.telegram.org/bot<TOKEN>/getUpdates` po wysłaniu wiadomości do bota)

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

Podczas tworzenia konfiguracji dla Telegrama podaj chat ID.

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
    "slackChannel": "#ci-results"
  },
  "events": [
    "run.finished",
    "run.failed"
  ],
  "enabled": true
}
```

**Pola konfiguracji dla każdego kanału:**

| Kanał | Pole konfiguracji | Przykład |
|-------|-------------------|---------|
| Email | `emails` | `{"emails": ["user@example.com"]}` |
| Slack | `slackChannel` | `{"slackChannel": "#ci-results"}` |
| Telegram | `chatId` | `{"chatId": "-1001234567890"}` |

### Zdarzenia

| Zdarzenie | Opis |
|-----------|------|
| `run.finished` | Przebieg testowy zakończony |
| `run.failed` | Przebieg testowy zakończony z błędami |
| `membership.requested` | Żądanie członkostwa w organizacji |

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
  "events": ["run.failed"],
  "enabled": true
}
```

#### Usunięcie konfiguracji

```http
DELETE /notifications/configs/:id
Authorization: Bearer <token>
```

### Powiadomienie testowe

Na każdej karcie konfiguracji w Dashboardzie znajduje się przycisk „Wyślij powiadomienie testowe". Wysyła on próbne powiadomienie przez wybrany kanał, aby sprawdzić poprawność konfiguracji.

```http
POST /notifications/configs/:id/test
Authorization: Bearer <token>
```

## Przez Dashboard

1. Przejdź do organizacji → „Powiadomienia"
2. Kliknij „Nowa konfiguracja"
3. Wybierz kanał (Email, Slack, Telegram, Push)
4. Skonfiguruj parametry kanału:
   - **Email**: wpisz adresy email odbiorców
   - **Slack**: wpisz nazwę kanału (np. `#ci-results`)
   - **Telegram**: wpisz chat ID
5. Wybierz zdarzenia do subskrypcji (np. `run.finished`, `run.failed`)
6. Zapisz konfigurację
7. Użyj przycisku powiadomienia testowego (ikona strzałki) na karcie konfiguracji, aby sprawdzić dostarczanie

## Architektura

Powiadomienia są dostarczane przez bezpośrednie wywołania HTTP między serwisami:

1. Gdy wystąpi odpowiednie zdarzenie (np. zakończenie przebiegu testowego), serwis źródłowy (Pipeline) wysyła żądanie HTTP do wewnętrznego endpointu Notification Service
2. Notification Service wyszukuje aktywne konfiguracje pasujące do organizacji i typu zdarzenia
3. Powiadomienia są wysyłane przez wszystkie pasujące skonfigurowane kanały (Email, Slack, Telegram, Push)
4. Każda próba dostarczenia jest logowana do celów audytu
