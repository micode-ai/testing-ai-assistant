# Pipeline'y i przebiegi testów

## Pipeline'y

Pipeline to konfiguracja automatycznego uruchamiania testów. Definiuje, jakie typy testów są wykonywane, w jakiej kolejności i pod jakimi warunkami.

### Tworzenie pipeline'u

1. Otwórz projekt → „Pipeline'y"
2. Kliknij „Nowy pipeline"
3. Skonfiguruj:
   - **Nazwa** — nazwa pipeline'u
   - **Typy testów** — wybierz jeden lub więcej:
     - Testy jednostkowe (Unit)
     - Testy integracyjne
     - Testy E2E
     - Testy obciążeniowe (Load)
     - Testy bezpieczeństwa (Security)
   - **Wyzwalacze** — warunki uruchomienia (push, PR, ręcznie)
   - **Parametry** — szczegółowe ustawienia dla każdego typu testów
4. Kliknij „Utwórz"

### Włączanie / Wyłączanie

Pipeline można tymczasowo wyłączyć bez usuwania:

1. Otwórz pipeline
2. Użyj przełącznika „Aktywny" / „Nieaktywny"

Lub przez API:
```
POST /pipelines/:id/toggle
```

### Typy testów

| Typ | Opis | Narzędzia |
|-----|------|-----------|
| **Unit** | Testy jednostkowe poszczególnych funkcji | Jest |
| **Integration** | Testy interakcji komponentów | Jest, Supertest |
| **E2E** | Kompleksowe testy scenariuszy użytkownika | Playwright, Cypress |
| **Load** | Testy obciążeniowe | k6, Artillery |
| **Security** | Testy bezpieczeństwa | OWASP ZAP, Snyk |

### API pipeline'ów

```
POST   /pipelines                    — Tworzenie pipeline'u
GET    /pipelines?projectId=<id>     — Lista pipeline'ów projektu
GET    /pipelines/:id                — Szczegóły pipeline'u
PATCH  /pipelines/:id                — Aktualizacja konfiguracji
DELETE /pipelines/:id                — Usunięcie
POST   /pipelines/:id/toggle         — Włączanie/wyłączanie
```

## Przebiegi testów

Przebieg testowy (Test Run) to pojedyncze wykonanie pipeline'u. Zawiera wyniki wszystkich testów, metryki pokrycia i artefakty.

### Uruchamianie

#### Automatyczne (przez webhook)

Przy push lub pull request do podłączonego repozytorium system automatycznie:

1. Otrzymuje zdarzenie od dostawcy Git
2. Znajduje aktywne pipeline'y projektu
3. Tworzy przebieg testowy
4. Przekazuje go do Temporal do wykonania

#### Ręczne

1. Otwórz pipeline → „Przebiegi"
2. Kliknij „Uruchom"
3. Opcjonalnie podaj gałąź lub commit
4. Potwierdź uruchomienie

Lub przez API:
```
POST /test-runs
Body: { "pipelineId": "...", "branch": "main", "commit": "abc123" }
```

### Cykl życia przebiegu

```
PENDING → RUNNING → PASSED / FAILED / ERROR
                  ↘ CANCELLED
```

| Status | Opis |
|--------|------|
| `PENDING` | Przebieg utworzony, oczekuje na wykonanie |
| `RUNNING` | Testy w trakcie wykonywania |
| `PASSED` | Wszystkie testy zakończone sukcesem |
| `FAILED` | Jeden lub więcej testów nie przeszło |
| `ERROR` | Wystąpił błąd wykonania |
| `CANCELLED` | Przebieg anulowany przez użytkownika |

### Anulowanie przebiegu

```
POST /test-runs/:id/cancel
```

### Wyniki

Każdy przebieg zawiera:

- **Wyniki testów** — status każdego testu (passed/failed/skipped)
- **Logi** — wyjście frameworka testowego
- **Czas wykonania** — czas trwania każdego testu i całkowity czas
- **Pokrycie kodu** — procent pokrycia (jeśli włączono zbieranie)
- **Artefakty** — zrzuty ekranu, raporty przesłane do MinIO

### Aktualizacje w czasie rzeczywistym

Pipeline Service obsługuje SSE (Server-Sent Events) dla postępu w czasie rzeczywistym:

- Zmiany statusu przebiegu
- Zakończenia poszczególnych testów
- Aktualizacje procentu wykonania

Dashboard i aplikacja mobilna automatycznie subskrybują strumień SSE.

### Pokrycie kodu

Migawki pokrycia są zapisywane dla każdego przebiegu:

- Ogólny procent pokrycia
- Pokrycie per plik
- Trendy pokrycia w czasie

### API przebiegów testowych

```
POST   /test-runs                    — Tworzenie i uruchomienie
GET    /test-runs?pipelineId=<id>    — Lista przebiegów
GET    /test-runs/:id                — Szczegóły przebiegu z wynikami
POST   /test-runs/:id/cancel         — Anulowanie przebiegu
```

## Temporal Workflows

Przebiegi testowe są orkiestrowane przez Temporal:

1. **Pipeline Service** tworzy rekord przebiegu i wysyła zdarzenie do Redpanda
2. **Test Runner** (Temporal Worker) odbiera zdarzenie i uruchamia workflow
3. Workflow wykonuje kroki: klonowanie, instalacja zależności, uruchomienie testów
4. Wyniki i artefakty są odsyłane przez zdarzenia
5. **Pipeline Service** aktualizuje status i wyniki

Możesz monitorować workflows w **Temporal UI**: http://localhost:8233

## Checklisty

Checklisty umożliwiają definiowanie, generowanie i wykonywanie scenariuszy testowych na działającej aplikacji.

### Tworzenie checklisty

1. Otwórz projekt → **"Checklists"** w menu bocznym
2. Kliknij **"New Checklist"**
3. Podaj nazwę, opis i URL docelowej aplikacji
4. Dodaj elementy testowe (tytuł, opis, oczekiwane zachowanie, priorytet)
5. Kliknij **"Create Checklist"**

### Checklisty generowane przez AI

1. Otwórz stronę AI → wybierz typ **"Checklist Generation"**
2. Podaj opis aplikacji lub URL
3. AI wygeneruje 10-25 scenariuszy testowych
4. Zaimportuj wygenerowaną checklistę

### Generowanie testów z elementów

1. Otwórz checklistę
2. Kliknij **"Generate Test"** przy dowolnym elemencie → AI utworzy test Playwright
3. Lub kliknij **"Generate All Tests"** aby wygenerować testy dla wszystkich elementów
4. Przejrzyj kod testu w rozwijanej sekcji pod każdym elementem

### Uruchamianie checklisty

1. Wprowadź **Target URL** (URL działającej aplikacji)
2. Kliknij **"Run Checklist"**
3. System sekwencyjnie wykonuje test Playwright dla każdego elementu
4. Wyniki pojawiają się w czasie rzeczywistym: RUNNING → PASSED / FAILED
5. Każdy element pokazuje czas trwania, log wyjścia i zrzuty ekranu

### Import / Eksport

**Eksport**: Otwórz checklistę → "Export" → zapisuje jako JSON

**Import**: Strona checklist → "Import" → wklej JSON

### API checklist

```
GET    /checklists?projectId=<id>            — Lista checklist
POST   /checklists                            — Tworzenie
GET    /checklists/:id                        — Pobranie z elementami
POST   /checklists/:id/items                  — Dodanie elementu
POST   /checklists/:id/run                    — Uruchomienie wykonania
POST   /checklists/:id/export                 — Eksport JSON
POST   /checklists/import                     — Import JSON
GET    /checklist-runs/:runId                  — Wyniki wykonania
```
