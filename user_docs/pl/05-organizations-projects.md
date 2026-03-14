# Organizacje i projekty

## Organizacje

Organizacja to najwyższa jednostka grupowania w Testing AI Assistant. Wszystkie projekty, pipeline'y i ustawienia istnieją w ramach organizacji.

### Tworzenie organizacji

1. Przejdź do sekcji „Organizacje"
2. Kliknij „Nowa organizacja"
3. Podaj nazwę i opis
4. Kliknij „Utwórz"

Automatycznie stajesz się administratorem utworzonej organizacji.

### Role członków

| Rola | Opis | Uprawnienia |
|------|------|-------------|
| `ADMIN` | Administrator | Pełny dostęp: zarządzanie członkami, projektami, ustawieniami |
| `MEMBER` | Członek | Tworzenie i zarządzanie projektami, uruchamianie testów |
| `VIEWER` | Obserwator | Tylko odczyt projektów i wyników |

### Zarządzanie członkami

#### Zapraszanie

1. Otwórz organizację → „Członkowie"
2. Kliknij „Zaproś"
3. Podaj email użytkownika i rolę
4. Zaproszenie zostanie wysłane na email

#### Zatwierdzanie / Odrzucanie

Administratorzy mogą zatwierdzać lub odrzucać wnioski o członkostwo:

1. Otwórz sekcję „Oczekujące" na liście członków
2. Kliknij „Zatwierdź" lub „Odrzuć"

#### Zmiana roli

1. Otwórz listę członków
2. Znajdź członka
3. Wybierz nową rolę z listy rozwijanej

#### Usuwanie członka

1. Otwórz listę członków
2. Kliknij „Usuń" obok członka
3. Potwierdź akcję

### API organizacji

```
POST   /organizations/:orgId/members/invite         — Zaproszenie członka
GET    /organizations/:orgId/members                 — Lista członków
PATCH  /organizations/:orgId/members/:id/approve     — Zatwierdzenie
PATCH  /organizations/:orgId/members/:id/reject      — Odrzucenie
PATCH  /organizations/:orgId/members/:id/role        — Zmiana roli
DELETE /organizations/:orgId/members/:id             — Usunięcie
```

## Projekty

Projekt należy do organizacji i reprezentuje repozytorium Git, dla którego konfigurowane jest automatyczne testowanie.

### Tworzenie projektu

1. Przejdź do organizacji → „Projekty"
2. Kliknij „Nowy projekt"
3. Wypełnij:
   - **Nazwa** — nazwa projektu
   - **Opis** — krótki opis
   - **Dostawca Git** — GitHub, GitLab lub Bitbucket
   - **URL repozytorium** — link do repozytorium
   - **Domyślna gałąź** — główna gałąź (np. `main`)
4. Kliknij „Utwórz"

### Podłączanie webhooka

Webhook umożliwia automatyczne uruchamianie testów przy push lub pull request.

1. Otwórz projekt → „Ustawienia"
2. Kliknij „Podłącz webhook"
3. System automatycznie utworzy webhook u dostawcy Git
4. Status wyświetli się jako „Podłączony"

> **Ważne:** Tworzenie webhooka wymaga uprawnień administratora repozytorium i skonfigurowanych tokenów OAuth dostawcy Git.

### Odłączanie webhooka

1. Otwórz projekt → „Ustawienia"
2. Kliknij „Odłącz webhook"
3. Webhook zostanie usunięty z dostawcy Git

### Przetwarzanie zdarzeń webhooka

Po otrzymaniu zdarzenia od dostawcy Git system:

1. Weryfikuje podpis i poprawność zdarzenia
2. Określa typ zdarzenia (push, pull request)
3. Znajduje pasujące aktywne pipeline'y
4. Automatycznie uruchamia przebiegi testowe

### API projektów

```
POST   /projects                           — Tworzenie projektu
GET    /projects?orgId=<id>                — Lista projektów
GET    /projects/:id                       — Szczegóły projektu
PATCH  /projects/:id                       — Aktualizacja
DELETE /projects/:id                       — Usunięcie
POST   /projects/:id/webhook/connect       — Podłączenie webhooka
DELETE /projects/:id/webhook/disconnect    — Odłączenie webhooka
```

## Dostawcy Git

### Obsługiwani dostawcy

| Dostawca | OAuth | Webhooki | Status |
|----------|-------|----------|--------|
| GitHub | Tak | Tak | Pełne wsparcie |
| GitLab | Tak | Tak | Pełne wsparcie |
| Bitbucket | Tak | Tak | Pełne wsparcie |

### Konfiguracja OAuth

Aby zintegrować się z dostawcą Git, skonfiguruj aplikację OAuth i ustaw klucze w `.env`:

**GitHub:**
```env
GITHUB_CLIENT_ID=twoj-client-id
GITHUB_CLIENT_SECRET=twoj-client-secret
```

**GitLab:**
```env
GITLAB_CLIENT_ID=twoj-client-id
GITLAB_CLIENT_SECRET=twoj-client-secret
```

**Bitbucket:**
```env
BITBUCKET_CLIENT_ID=twoj-client-id
BITBUCKET_CLIENT_SECRET=twoj-client-secret
```
