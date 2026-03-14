# Мобильное приложение

## Обзор

| Параметр | Значение |
|----------|----------|
| **Фреймворк** | Expo (React Native) |
| **Язык** | TypeScript |
| **Навигация** | Expo Router (file-based routing) |
| **Хранилище** | Zustand |
| **Безопасное хранилище** | expo-secure-store |
| **Push-уведомления** | Expo Notifications |

## Архитектура

```mermaid
graph TD
    subgraph Expo App
        subgraph Навигация
            ROOT[Root Layout<br/>_layout.tsx]
            AUTH_LAYOUT[Auth Layout<br/>auth/_layout.tsx]
            TABS_LAYOUT[Tabs Layout<br/>tabs/_layout.tsx]
        end

        subgraph Экраны
            LOGIN[Login<br/>auth/login.tsx]
            REGISTER[Register<br/>auth/register.tsx]
            HOME[Home<br/>tabs/index.tsx]
            PROJECTS[Projects<br/>tabs/projects.tsx]
            RUNS[Runs<br/>tabs/runs.tsx]
            SETTINGS[Settings<br/>tabs/settings.tsx]
            PRJ_DETAIL[Project Detail<br/>projects/projectId.tsx]
            RUN_DETAIL[Run Detail<br/>runs/runId.tsx]
        end

        subgraph Библиотеки
            API[API Client<br/>lib/api/]
            AUTH_CTX[Auth Context<br/>lib/auth/]
            STORE[App Store<br/>lib/stores/]
            PUSH[Push Setup<br/>lib/notifications/]
        end

        subgraph Компоненты
            UI[UI Kit<br/>button, card, input, badge, loading]
            SHARED[Shared<br/>run-status-badge, provider-icon]
        end
    end

    subgraph Backend
        API_GW[Traefik API Gateway]
    end

    API --> API_GW
```

## Карта экранов

```mermaid
flowchart TD
    START([Запуск приложения]) --> ROOT[Root Layout<br/>_layout.tsx]

    ROOT --> CHECK{Авторизован?}

    CHECK -->|Нет| AUTH[Auth Layout]
    CHECK -->|Да| TABS[Tab Navigator]

    subgraph AUTH_GROUP [Группа авторизации]
        AUTH --> LOGIN[Login<br/>Email + Password]
        AUTH --> REG[Register<br/>Создание аккаунта]
        LOGIN <-->|Переключение| REG
    end

    subgraph TABS_GROUP [Таб-навигатор]
        TABS --> TAB_HOME[Home<br/>Обзор, последние запуски]
        TABS --> TAB_PROJECTS[Projects<br/>Список проектов]
        TABS --> TAB_RUNS[Runs<br/>Все тестовые запуски]
        TABS --> TAB_SETTINGS[Settings<br/>Настройки приложения]
    end

    subgraph DETAIL_GROUP [Экраны деталей]
        TAB_PROJECTS -->|Нажатие| PRJ_DETAIL[Project Detail<br/>projects/projectId]
        TAB_RUNS -->|Нажатие| RUN_DETAIL[Run Detail<br/>runs/runId]
        TAB_HOME -->|Нажатие на запуск| RUN_DETAIL
        PRJ_DETAIL -->|Нажатие на запуск| RUN_DETAIL
    end

    LOGIN -->|Успешный вход| TABS
    REG -->|Успешная регистрация| TABS

    style AUTH_GROUP fill:#fef3e2,stroke:#f5a623
    style TABS_GROUP fill:#e8f4f8,stroke:#4a9eff
    style DETAIL_GROUP fill:#e8f8e8,stroke:#27ae60
```

## Поток авторизации

### SecureStore

Мобильное приложение использует `expo-secure-store` для безопасного хранения токенов в зашифрованном хранилище устройства (Keychain на iOS, EncryptedSharedPreferences на Android).

```mermaid
sequenceDiagram
    participant U as Пользователь
    participant APP as Мобильное приложение
    participant SS as SecureStore
    participant API as Identity API

    Note over U,API: Первый вход
    U->>APP: Ввод email + password
    APP->>API: POST /auth/login
    API-->>APP: {accessToken, refreshToken, user}
    APP->>SS: Сохранить accessToken
    APP->>SS: Сохранить refreshToken
    APP->>APP: Обновить AuthContext (isLoggedIn=true)
    APP-->>U: Переход на Tab Navigator

    Note over U,API: Повторный запуск приложения
    APP->>SS: Прочитать accessToken
    alt Токен есть
        APP->>API: GET /auth/me (с токеном)
        alt Токен валиден
            API-->>APP: User data
            APP-->>U: Tab Navigator
        else Токен истёк
            APP->>SS: Прочитать refreshToken
            APP->>API: POST /auth/refresh
            API-->>APP: {accessToken, refreshToken}
            APP->>SS: Сохранить новые токены
            APP-->>U: Tab Navigator
        end
    else Токена нет
        APP-->>U: Auth Screen
    end

    Note over U,API: Выход
    U->>APP: Нажатие "Выход"
    APP->>API: POST /auth/logout
    APP->>SS: Удалить accessToken
    APP->>SS: Удалить refreshToken
    APP->>APP: Очистить AuthContext
    APP-->>U: Auth Screen
```

## Push-уведомления

### Архитектура

```mermaid
sequenceDiagram
    participant APP as Мобильное приложение
    participant EXPO as Expo Push Service
    participant NOT as Notification Service
    participant RP as Redpanda

    Note over APP,EXPO: Регистрация устройства
    APP->>EXPO: requestPermissions()
    EXPO-->>APP: ExpoPushToken
    APP->>NOT: POST /notifications/register-device<br/>{token, platform, userId}

    Note over RP,APP: Получение уведомления
    RP->>NOT: Событие: run.finished
    NOT->>NOT: Найти конфиг channel=PUSH
    NOT->>EXPO: POST /send {to: ExpoPushToken, title, body}
    EXPO->>APP: Push Notification
    APP->>APP: Показать уведомление
    APP->>APP: При нажатии → навигация к Run Detail
```

### Типы push-уведомлений

| Событие | Заголовок | Действие при нажатии |
|---------|-----------|---------------------|
| `run.finished` (PASSED) | "Тесты пройдены" | Открыть Run Detail |
| `run.finished` (FAILED) | "Тесты провалены" | Открыть Run Detail |
| `membership.approved` | "Приглашение принято" | Открыть Home |
| `generation.completed` | "AI-анализ готов" | Открыть Project Detail |

## Интеграция с API

### API Client

Файл `lib/api/client.ts` реализует базовый HTTP-клиент с автоматическим добавлением токена:

```typescript
// Упрощённая структура
class ApiClient {
  private baseUrl: string;

  async request(path: string, options?: RequestInit) {
    const token = await SecureStore.getItemAsync('accessToken');
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : '',
        ...options?.headers,
      },
    });

    if (response.status === 401) {
      // Попытка обновления токена
      await this.refreshToken();
      return this.request(path, options);
    }

    return response.json();
  }
}
```

### API-модули

| Модуль | Файл | Описание |
|--------|------|----------|
| Auth | `lib/api/auth.ts` | Логин, регистрация, refresh |
| Organizations | `lib/api/organizations.ts` | Список организаций, участники |
| Projects | `lib/api/projects.ts` | CRUD проектов |
| Test Runs | `lib/api/test-runs.ts` | Запуски и результаты |

## Управление состоянием

### Zustand Store

```typescript
// lib/stores/app-store.ts
interface AppStore {
  // Auth
  user: User | null;
  isLoggedIn: boolean;

  // Organizations
  currentOrg: Organization | null;
  organizations: Organization[];

  // Actions
  setUser: (user: User | null) => void;
  setCurrentOrg: (org: Organization) => void;
  logout: () => void;
}
```

## UI-компоненты

| Компонент | Файл | Описание |
|-----------|------|----------|
| `Button` | `components/ui/button.tsx` | Кнопка с вариантами стилей |
| `Card` | `components/ui/card.tsx` | Карточка-контейнер |
| `Input` | `components/ui/input.tsx` | Текстовое поле ввода |
| `Badge` | `components/ui/badge.tsx` | Метка/бейдж |
| `Loading` | `components/ui/loading.tsx` | Индикатор загрузки |
| `RunStatusBadge` | `components/shared/run-status-badge.tsx` | Бейдж статуса запуска (PASSED/FAILED/...) |
| `ProviderIcon` | `components/shared/provider-icon.tsx` | Иконка Git-провайдера |

## Структура файлов

```
apps/mobile/
├── src/
│   ├── app/                    # Expo Router (file-based)
│   │   ├── _layout.tsx         # Root layout
│   │   ├── index.tsx           # Entry redirect
│   │   ├── auth/
│   │   │   ├── _layout.tsx     # Auth layout
│   │   │   ├── login.tsx       # Login screen
│   │   │   └── register.tsx    # Register screen
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx     # Tab navigator
│   │   │   ├── index.tsx       # Home tab
│   │   │   ├── projects.tsx    # Projects tab
│   │   │   ├── runs.tsx        # Runs tab
│   │   │   └── settings.tsx    # Settings tab
│   │   ├── projects/
│   │   │   └── [projectId].tsx # Project detail
│   │   └── runs/
│   │       └── [runId].tsx     # Run detail
│   ├── components/
│   │   ├── ui/                 # Базовые UI-компоненты
│   │   └── shared/             # Общие компоненты
│   ├── lib/
│   │   ├── api/                # HTTP-клиент и API-модули
│   │   ├── auth/               # AuthContext
│   │   ├── notifications/      # Push-уведомления
│   │   └── stores/             # Zustand stores
│   └── types/                  # TypeScript типы
```
