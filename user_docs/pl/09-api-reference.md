# Dokumentacja API

## Informacje ogólne

Wszystkie endpointy API używają REST i JSON. Uwierzytelnianie przez token JWT Bearer.

**Nagłówek autoryzacji:**
```
Authorization: Bearer <access_token>
```

**Bazowe URL (lokalne środowisko):**
- Identity: `http://localhost:3001`
- Organization: `http://localhost:3002`
- Project: `http://localhost:3003`
- Pipeline: `http://localhost:3004`
- AI: `http://localhost:3005`
- Notification: `http://localhost:3006`

**Przez API Gateway (produkcja):**
```
http://localhost/api/<service>
```

## Kody odpowiedzi

| Kod | Opis |
|-----|------|
| `200` | Pomyślne żądanie |
| `201` | Zasób utworzony |
| `400` | Błędne żądanie (błędy walidacji) |
| `401` | Nieuwierzytelniony |
| `403` | Dostęp zabroniony |
| `404` | Zasób nie znaleziony |
| `409` | Konflikt (duplikat) |
| `500` | Wewnętrzny błąd serwera |

---

## Identity Service (port 3001)

### Uwierzytelnianie

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `POST` | `/auth/register` | Rejestracja nowego użytkownika |
| `POST` | `/auth/login` | Logowanie |
| `POST` | `/auth/refresh` | Odświeżenie tokenu dostępu |
| `POST` | `/auth/logout` | Wylogowanie |
| `GET` | `/auth/me` | Pobranie bieżącego użytkownika |

#### POST /auth/register

```json
// Żądanie
{
  "name": "Jan Kowalski",
  "email": "jan@example.com",
  "password": "securePassword123"
}

// Odpowiedź 201
{
  "id": "uuid",
  "name": "Jan Kowalski",
  "email": "jan@example.com",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

#### POST /auth/login

```json
// Żądanie
{
  "email": "jan@example.com",
  "password": "securePassword123"
}

// Odpowiedź 200
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

#### POST /auth/refresh

```json
// Żądanie
{
  "refreshToken": "eyJ..."
}

// Odpowiedź 200
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

---

## Organization Service (port 3002)

### Członkowie

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `POST` | `/organizations/:orgId/members/invite` | Zaproszenie członka |
| `GET` | `/organizations/:orgId/members` | Lista członków |
| `PATCH` | `/organizations/:orgId/members/:id/approve` | Zatwierdzenie |
| `PATCH` | `/organizations/:orgId/members/:id/reject` | Odrzucenie |
| `PATCH` | `/organizations/:orgId/members/:id/role` | Zmiana roli |
| `DELETE` | `/organizations/:orgId/members/:id` | Usunięcie członka |

#### POST /organizations/:orgId/members/invite

```json
// Żądanie
{
  "email": "user@example.com",
  "role": "MEMBER"
}

// Odpowiedź 201
{
  "id": "uuid",
  "userId": "uuid",
  "orgId": "uuid",
  "role": "MEMBER",
  "status": "PENDING"
}
```

---

## Project Service (port 3003)

### Projekty

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `POST` | `/projects` | Tworzenie projektu |
| `GET` | `/projects?orgId=<id>` | Lista projektów |
| `GET` | `/projects/:id` | Pobranie projektu |
| `PATCH` | `/projects/:id` | Aktualizacja projektu |
| `DELETE` | `/projects/:id` | Usunięcie projektu |
| `POST` | `/projects/:id/webhook/connect` | Podłączenie webhooka |
| `DELETE` | `/projects/:id/webhook/disconnect` | Odłączenie webhooka |

#### POST /projects

```json
// Żądanie
{
  "name": "My Project",
  "description": "Opis projektu",
  "orgId": "uuid",
  "gitProvider": "GITHUB",
  "repoUrl": "https://github.com/org/repo",
  "defaultBranch": "main"
}

// Odpowiedź 201
{
  "id": "uuid",
  "name": "My Project",
  "orgId": "uuid",
  "gitProvider": "GITHUB",
  "webhookConnected": false
}
```

---

## Pipeline Service (port 3004)

### Pipeline'y

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `POST` | `/pipelines` | Tworzenie pipeline'u |
| `GET` | `/pipelines?projectId=<id>` | Lista pipeline'ów |
| `GET` | `/pipelines/:id` | Pobranie pipeline'u |
| `PATCH` | `/pipelines/:id` | Aktualizacja pipeline'u |
| `DELETE` | `/pipelines/:id` | Usunięcie pipeline'u |
| `POST` | `/pipelines/:id/toggle` | Włączanie/wyłączanie |

### Przebiegi testowe

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `POST` | `/test-runs` | Tworzenie i uruchomienie |
| `GET` | `/test-runs?pipelineId=<id>` | Lista przebiegów |
| `GET` | `/test-runs/:id` | Szczegóły przebiegu |
| `POST` | `/test-runs/:id/cancel` | Anulowanie przebiegu |

#### POST /test-runs

```json
// Żądanie
{
  "pipelineId": "uuid",
  "branch": "main",
  "commit": "abc123def"
}

// Odpowiedź 201
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

## AI Service (port 3005)

### Generowanie AI

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `POST` | `/ai/generate` | Uruchomienie generowania |
| `GET` | `/ai/generations?projectId=<id>&type=<type>` | Lista generowań |
| `GET` | `/ai/generations/:id` | Szczegóły generowania |
| `PATCH` | `/ai/generations/:id/feedback` | Informacja zwrotna |
| `GET` | `/ai/generations/stats?projectId=<id>` | Statystyki |

#### POST /ai/generate

```json
// Żądanie
{
  "projectId": "uuid",
  "type": "TEST_GENERATION"
}

// Odpowiedź 201
{
  "id": "uuid",
  "projectId": "uuid",
  "type": "TEST_GENERATION",
  "status": "PROCESSING",
  "createdAt": "2026-03-12T10:00:00Z"
}
```

---

## Notification Service (port 3006)

### Konfiguracje powiadomień

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `POST` | `/notifications/configs` | Tworzenie konfiguracji |
| `GET` | `/notifications/configs?orgId=<id>` | Lista konfiguracji |
| `GET` | `/notifications/configs/:id` | Pobranie konfiguracji |
| `PATCH` | `/notifications/configs/:id` | Aktualizacja konfiguracji |
| `DELETE` | `/notifications/configs/:id` | Usunięcie konfiguracji |

---

## Health Check (wszystkie serwisy)

```
GET /health → 200 OK
```
