# Aplikacja mobilna

## Przegląd

Aplikacja mobilna Testing AI Assistant jest zbudowana na Expo 52 i React Native 0.76.5. Obsługuje iOS i Android oraz zapewnia dostęp do głównych funkcji platformy w podróży.

## Wymagania systemowe

| Komponent | Wymaganie |
|-----------|----------|
| Node.js | >= 20.0.0 |
| Expo CLI | Instalowane przez `npx` |
| iOS | Xcode 15+ (do rozwoju na iOS) |
| Android | Android Studio + SDK 34+ |
| Expo Go | Do szybkiego testowania na urządzeniu |

## Instalacja i uruchomienie

### Lokalne środowisko deweloperskie

```bash
cd apps/mobile
npm install

# Uruchom serwer deweloperski Expo
npm start

# Uruchom na Androidzie
npm run android

# Uruchom na iOS
npm run ios

# Uruchom w przeglądarce
npm run web
```

### Testowanie na urządzeniu

1. Zainstaluj **Expo Go** na urządzeniu mobilnym (App Store / Google Play)
2. Uruchom `npm start` w katalogu `apps/mobile`
3. Zeskanuj kod QR z terminala kamerą urządzenia
4. Aplikacja otworzy się w Expo Go

## Funkcjonalność

### Uwierzytelnianie

- Logowanie przez email i hasło
- Logowanie OAuth przez GitHub, GitLab, Bitbucket
- Bezpieczne przechowywanie tokenów przez `expo-secure-store`
- Automatyczne odświeżanie tokenów

### Główne ekrany

- **Strona główna** — przegląd bieżącego stanu: aktywne przebiegi, ostatnie wyniki
- **Organizacje** — przeglądanie i przełączanie między organizacjami
- **Projekty** — lista projektów, status webhooków
- **Pipeline'y** — przeglądanie i uruchamianie pipeline'ów
- **Przebiegi testów** — śledzenie wykonywania, przeglądanie wyników
- **Generowanie AI** — uruchamianie i przeglądanie generowań AI
- **Powiadomienia** — powiadomienia push o zdarzeniach

### Powiadomienia push

Aplikacja obsługuje powiadomienia push przez `expo-notifications`:

- Zakończenie przebiegów testowych
- Wykrycie awarii
- Zaproszenia do organizacji
- Wyniki generowania AI

### Nawigacja

Aplikacja używa `expo-router` (routing oparty na plikach):

- Zakładki dla głównych sekcji
- Nawigacja stosowa dla szczegółów
- Deep linking dla bezpośredniego dostępu

## Technologie

| Technologia | Przeznaczenie |
|------------|--------------|
| Expo 52 | Platforma React Native |
| React Native 0.76.5 | Framework mobilny |
| expo-router 4 | Routing oparty na plikach |
| expo-secure-store | Bezpieczne przechowywanie danych |
| expo-notifications | Powiadomienia push |
| Zustand | Zarządzanie stanem |
| React Query | Stan serwera i cache |

## Przydatne polecenia

| Polecenie | Opis |
|-----------|------|
| `npm start` | Uruchom serwer deweloperski Expo |
| `npm run android` | Uruchom na Androidzie |
| `npm run ios` | Uruchom na iOS |
| `npm run web` | Uruchom w przeglądarce |
| `npm run lint` | Uruchom linter |
| `npm run typecheck` | Sprawdzanie typów TypeScript |
