# Panel webowy (Dashboard)

## Przegląd

Dashboard to aplikacja webowa zbudowana na Next.js 15 z React 19, zapewniająca pełny interfejs do zarządzania testowaniem. Dostęp pod adresem: **http://localhost:4200**.

## Uwierzytelnianie

### Rejestracja

1. Otwórz http://localhost:4200
2. Kliknij „Zarejestruj się"
3. Wypełnij formularz: imię, email, hasło
4. Potwierdź rejestrację

### Logowanie

- **Email i hasło** — standardowe logowanie
- **Przez OAuth** — przyciski GitHub, GitLab, Bitbucket (jeśli skonfigurowane)

Po zalogowaniu otrzymujesz token JWT, który jest automatycznie odświeżany przez refresh token.

### Wylogowanie

Kliknij na awatar w prawym górnym rogu i wybierz „Wyloguj się". Token zostanie unieważniony i dodany do czarnej listy.

## Główne sekcje

### Organizacje

- **Lista organizacji** — wszystkie organizacje, do których należysz
- **Tworzenie organizacji** — przycisk „Nowa organizacja"
- **Ustawienia organizacji** — edycja nazwy, opisu
- **Zarządzanie członkami** — zapraszanie, zatwierdzanie, przypisywanie ról

### Projekty

- **Lista projektów** — projekty w ramach wybranej organizacji
- **Tworzenie projektu** — podanie nazwy, opisu, repozytorium Git
- **Podłączenie webhooka** — automatyczne uruchamianie testów przy push/PR
- **Ustawienia projektu** — edycja parametrów, odłączenie webhooka

### Pipeline'y

- **Lista pipeline'ów** — wszystkie pipeline'y projektu
- **Tworzenie pipeline'u** — wybór typów testów, konfiguracja parametrów
- **Włączanie/wyłączanie** — przełącznik aktywności pipeline'u
- **Szczegóły pipeline'u** — historia przebiegów, konfiguracja

### Przebiegi testów

- **Lista przebiegów** — wszystkie uruchomienia testów dla pipeline'u
- **Ręczne uruchomienie** — przycisk „Uruchom"
- **Anulowanie przebiegu** — zatrzymanie wykonywania
- **Szczegóły przebiegu** — wyniki poszczególnych testów, logi, czas wykonania
- **Aktualizacje w czasie rzeczywistym** — SSE do śledzenia postępu

### Generowanie AI

- **Uruchomienie generowania** — wybór typu: generowanie testów, wykrywanie błędów, testy niestabilne, pokrycie
- **Lista generowań** — historia wszystkich generowań AI
- **Szczegóły generowania** — wygenerowany kod, wyjaśnienia
- **Informacja zwrotna** — zaakceptuj lub odrzuć z komentarzem
- **Statystyki** — ogólna analityka generowań AI

### Czat AI

- **Interfejs czatu** — konwersacyjny asystent AI dla każdego projektu
- **Wywoływanie narzędzi** — AI może tworzyć checklisty, uruchamiać pipeline'y, przeglądać wyniki
- **Baza wiedzy** — odpowiada na pytania korzystając z zaindeksowanej dokumentacji (RAG)
- **Historia konwersacji** — poprzednie czaty są zapisywane i dostępne z bocznego panelu
- **Strumieniowe odpowiedzi** — wyświetlanie odpowiedzi w czasie rzeczywistym znak po znaku

### Pokrycie kodu

- **Migawki pokrycia** — procent pokrycia na przebieg
- **Trendy** — wykresy zmian pokrycia w czasie

### Powiadomienia

- **Konfiguracje** — ustawianie kanałów powiadomień
- **Historia** — lista wysłanych powiadomień

## Technologie frontendowe

| Technologia | Przeznaczenie |
|------------|--------------|
| Next.js 15 | Framework z Server Components |
| React 19 | Biblioteka UI |
| NextAuth v5 | Uwierzytelnianie |
| Tailwind CSS | Stylowanie |
| shadcn/ui | Komponenty UI |
| Radix UI | Prymitywy komponentów |
| Zustand | Zarządzanie stanem |
| React Query | Zarządzanie stanem serwera i cache |
| React Hook Form | Zarządzanie formularzami |
| Lucide React | Ikony |

## Nawigacja

Menu boczne jest wielopoziomowe — widoczne sekcje zależą od kontekstu:

**Poziom 0** (zawsze widoczne):
- **Strona główna** — przegląd i szybkie akcje
- **Organizacje** — zarządzanie organizacjami

**Poziom 1** (po wybraniu organizacji):
- **Projekty** — zarządzanie projektami w organizacji
- **Uruchomienia** — przebiegi testów w organizacji

**Poziom 2** (po wybraniu projektu):
- **Czat AI** — konwersacyjny asystent AI
- **Potoki** — pipeline'y testowe
- **Pokrycie** — pokrycie kodu
- **Listy kontrolne** — checklisty testowe
- **Centrum AI** — generowanie i analiza AI

Przełącznik organizacji (OrgSwitcher) po wybraniu organizacji automatycznie nawiguje do strony `/projects`. Karty organizacji po kliknięciu przechodzą do strony szczegółów organizacji, a licznik członków prowadzi do `/organizations/{id}/members`.

## Wskazówki

- Używaj filtrów i wyszukiwania do nawigacji po dużych listach
- Aktualizacje SSE działają automatycznie — nie trzeba ręcznie odświeżać strony
- Dla dostępu mobilnego użyj aplikacji Expo (zobacz [Aplikacja mobilna](./04-mobile.md))
