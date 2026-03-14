# Generowanie AI

## Przegląd

AI Service wykorzystuje agentów opartych na LangGraph i API OpenAI do automatycznej analizy kodu i generowania testów. Serwis dostępny na porcie **3005**.

## Typy generowania AI

### 1. Generowanie testów (Test Generation)

Automatyczne tworzenie testów dla istniejącego kodu.

**Jak to działa:**
1. Agent AI analizuje kod źródłowy projektu
2. Identyfikuje funkcje i klasy niepokryte testami
3. Generuje testy z uwzględnieniem używanego frameworka (Jest, Vitest itd.)
4. Zwraca gotowy do użycia kod testów

**Kiedy używać:**
- Przy niskim pokryciu kodu
- Dla nowego kodu napisanego bez TDD
- Do generowania testów dla przypadków brzegowych

### 2. Wykrywanie błędów (Bug Detection)

Analiza kodu przez AI pod kątem potencjalnych błędów.

**Jak to działa:**
1. Agent skanuje kod projektu
2. Szuka wzorców często prowadzących do błędów
3. Analizuje warunki brzegowe i obsługę błędów
4. Dostarcza opisy znalezionych problemów i rekomendacje naprawy

**Co wykrywa:**
- Nieobsłużone wyjątki
- Wyścigi (race conditions)
- Wycieki pamięci
- Problemy z typowaniem
- Nieprawidłowa obsługa null/undefined

### 3. Wykrywanie niestabilnych testów (Flaky Test Detection)

Identyfikacja niestabilnych testów, które czasem przechodzą, a czasem nie.

**Jak to działa:**
1. Agent analizuje historię przebiegów
2. Znajduje testy z niestabilnymi wynikami
3. Określa prawdopodobną przyczynę niestabilności
4. Proponuje sposoby naprawy

**Typowe przyczyny niestabilnych testów:**
- Zależność od czasu
- Wyścigi w kodzie asynchronicznym
- Zależność od kolejności wykonania
- Nieoczyszczony stan między testami

### 4. Porady dotyczące pokrycia (Coverage Advice)

Rekomendacje dotyczące poprawy pokrycia kodu testami.

**Jak to działa:**
1. Agent analizuje bieżące pokrycie
2. Identyfikuje krytyczne niepokryte obszary
3. Priorytetyzuje według ważności
4. Proponuje konkretne testy do napisania

### 5. Generowanie checklisty

Checklisty testowe generowane przez AI na podstawie analizy aplikacji.

**Jak to działa:**
1. Podaj URL docelowy, URL repozytorium lub opis aplikacji
2. Agent AI analizuje funkcje i przepływy aplikacji
3. Generuje kompleksową checklistę 10-25 scenariuszy testowych
4. Każdy element zawiera tytuł, opis, oczekiwane zachowanie i priorytet

**Kiedy używać:**
- Rozpoczynanie QA dla nowej aplikacji
- Kompleksowe planowanie testów regresyjnych
- Wdrażanie nowych członków zespołu QA

### 6. Generowanie testów z checklisty

Testy Playwright E2E generowane przez AI z poszczególnych elementów checklisty.

**Jak to działa:**
1. Wybierz element checklisty opisujący scenariusz testowy
2. Agent AI analizuje scenariusz i planuje kroki testu
3. Generuje kompletny test Playwright z dostępnymi selektorami
4. Waliduje składnię i udoskonala do 3 razy
5. Zwraca gotowy do wykonania kod testu

**Kiedy używać:**
- Automatyzacja ręcznych checklist testowych
- Generowanie testów E2E do testowania funkcjonalnego
- Konwersja kryteriów akceptacji na wykonywalne testy

## Użytkowanie

### Przez Dashboard

1. Otwórz projekt → „AI"
2. Kliknij „Nowe generowanie"
3. Wybierz typ generowania
4. Poczekaj na wynik
5. Przejrzyj i zdecyduj: „Zaakceptuj" lub „Odrzuć"

### Przez API

#### Uruchomienie generowania

```http
POST /ai/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "projectId": "uuid-projektu",
  "type": "TEST_GENERATION"
}
```

Dostępne typy:
- `TEST_GENERATION` — generowanie testów
- `BUG_DETECTION` — wykrywanie błędów
- `FLAKY_TEST_DETECTION` — wykrywanie niestabilnych testów
- `COVERAGE_ADVICE` — rekomendacje pokrycia

#### Lista generowań

```http
GET /ai/generations?projectId=<id>&type=<type>
Authorization: Bearer <token>
```

#### Szczegóły generowania

```http
GET /ai/generations/:id
Authorization: Bearer <token>
```

#### Informacja zwrotna

```http
PATCH /ai/generations/:id/feedback
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "ACCEPTED",
  "feedback": "Testy są poprawne, stosuję"
}
```

Statusy: `ACCEPTED`, `REJECTED`

#### Statystyki

```http
GET /ai/generations/stats?projectId=<id>
Authorization: Bearer <token>
```

## Konfiguracja AI

Ustaw w `.env`:

```env
# Klucz API OpenAI (wymagany)
OPENAI_API_KEY=sk-twoj-klucz

# Modele
OPENAI_MODEL_FAST=gpt-4.1-mini      # Dla szybkich zadań
OPENAI_MODEL_ADVANCED=o3             # Dla złożonej analizy
```

## Architektura agentów

AI Service używa LangGraph do orkiestracji agentów:

```
Żądanie → Router → Agent (LangGraph)
                        ↓
               Analiza kodu projektu
                        ↓
               Generowanie wyniku
                        ↓
               Zapis do bazy danych
                        ↓
               Zdarzenie do Redpanda
```

Każdy typ generowania ma wyspecjalizowanego agenta z unikalnym zestawem narzędzi i promptów.

## Najlepsze praktyki

- **Weryfikuj wyniki** — AI może generować niepoprawne testy
- **Używaj informacji zwrotnej** — to pomaga poprawić jakość generowania
- **Zacznij od TEST_GENERATION** — to najbardziej dojrzały typ generowania
- **Łącz z ręcznym pokryciem** — AI uzupełnia, a nie zastępuje ręczne testy
