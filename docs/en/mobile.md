# Mobile App

## Overview

| Property | Value |
|---|---|
| **Framework** | Expo (React Native) |
| **Expo Version** | ~52.0.0 |
| **React Native** | 0.76.5 |
| **Router** | expo-router ~4.0.0 |
| **State Management** | Zustand 5 + React Query 5 |
| **Package Name** | `@testing-ai/mobile` |

## Architecture

```mermaid
graph TD
    subgraph MobileApp["Expo Mobile App"]
        Router["expo-router<br/>(File-based routing)"]
        AuthCtx["AuthProvider<br/>(Context + SecureStore)"]
        QueryClient["React Query<br/>(Server state)"]
        Zustand["Zustand Store<br/>(Client state)"]
        APIClient["API Client<br/>(fetch + auth interceptor)"]
    end

    subgraph Backend["Backend Services"]
        Identity["Identity :3001"]
        Org["Organization :3002"]
        Project["Project :3003"]
        Pipeline["Pipeline :3004"]
    end

    subgraph Device["Device APIs"]
        SecureStore["expo-secure-store<br/>(Token storage)"]
        Notifications["expo-notifications<br/>(Push notifications)"]
    end

    Router --> AuthCtx
    AuthCtx --> SecureStore
    Router --> QueryClient
    QueryClient --> APIClient
    Zustand --> APIClient
    APIClient --> Identity
    APIClient --> Org
    APIClient --> Project
    APIClient --> Pipeline
    Notifications --> Device
```

## Screen Map

```mermaid
flowchart TD
    Root["_layout.tsx<br/>(Root Layout)"]
    Root --> Splash["index.tsx<br/>(Splash / Auth Check)"]

    Splash -- "No token" --> AuthGroup
    Splash -- "Has token" --> TabGroup

    subgraph AuthGroup["auth/ (Auth Screens)"]
        AuthLayout["_layout.tsx"]
        Login["login.tsx<br/>Email + Password"]
        Register["register.tsx<br/>Create Account"]
    end

    AuthLayout --> Login
    AuthLayout --> Register

    subgraph TabGroup["(tabs)/ (Tab Navigator)"]
        TabLayout["_layout.tsx<br/>(Bottom Tab Bar)"]
        Home["index.tsx<br/>Dashboard Home"]
        Projects["projects.tsx<br/>Project List"]
        Runs["runs.tsx<br/>Recent Runs"]
        Settings["settings.tsx<br/>User Settings"]
    end

    TabLayout --> Home
    TabLayout --> Projects
    TabLayout --> Runs
    TabLayout --> Settings

    Projects -- "Tap project" --> ProjectDetail["projects/[projectId].tsx<br/>Project Details"]
    Runs -- "Tap run" --> RunDetail["runs/[runId].tsx<br/>Run Details"]
```

## Auth Flow

```mermaid
sequenceDiagram
    participant User
    participant App as Mobile App
    participant SecureStore as expo-secure-store
    participant API as Identity Service

    Note over User,API: App Launch
    App->>SecureStore: Read stored tokens
    alt Tokens exist
        App->>API: GET /auth/me<br/>Authorization: Bearer <token>
        alt Token valid
            API-->>App: 200 User profile
            App->>App: Navigate to (tabs)/
        else Token expired
            API-->>App: 401 Unauthorized
            App->>SecureStore: Read refreshToken
            App->>API: POST /auth/refresh<br/>{refreshToken}
            alt Refresh successful
                API-->>App: 200 {accessToken, refreshToken}
                App->>SecureStore: Store new tokens
                App->>App: Navigate to (tabs)/
            else Refresh failed
                App->>SecureStore: Delete tokens
                App->>App: Navigate to auth/login
            end
        end
    else No tokens
        App->>App: Navigate to auth/login
    end

    Note over User,API: Login
    User->>App: Enter email + password
    App->>API: POST /auth/login<br/>{email, password}
    alt Login successful
        API-->>App: 200 {accessToken, refreshToken, user}
        App->>SecureStore: Store accessToken
        App->>SecureStore: Store refreshToken
        App->>App: Navigate to (tabs)/
    else Login failed
        API-->>App: 401 Invalid credentials
        App->>App: Show error message
    end

    Note over User,API: Logout
    User->>App: Tap "Logout"
    App->>API: POST /auth/logout<br/>{refreshToken}
    App->>SecureStore: Delete all tokens
    App->>App: Navigate to auth/login
```

## Push Notifications

### Setup Flow

```mermaid
sequenceDiagram
    participant User
    participant App as Mobile App
    participant Expo as Expo Push Service
    participant API as Notification Service

    Note over User,API: First Launch After Login
    App->>App: Check notification permissions
    alt Permissions not granted
        App->>User: Request permission dialog
        User->>App: Grant permissions
    end
    App->>Expo: Register for push notifications
    Expo-->>App: expoPushToken
    App->>API: POST /notifications/register-device<br/>{userId, expoPushToken, platform}
    API-->>App: 200 Device registered

    Note over User,API: Receiving Notifications
    API->>Expo: Send push notification<br/>{to: expoPushToken, title, body, data}
    Expo->>App: Deliver notification
    alt App in foreground
        App->>App: Show in-app notification banner
    else App in background
        App->>User: System notification
        User->>App: Tap notification
        App->>App: Deep link to relevant screen
    end
```

### Push Notification Types

| Event | Title | Body | Deep Link |
|---|---|---|---|
| `run.finished` (PASSED) | "Tests Passed" | "{project}: All tests passed on {branch}" | `/runs/{runId}` |
| `run.finished` (FAILED) | "Tests Failed" | "{project}: {failedCount} tests failed on {branch}" | `/runs/{runId}` |
| `membership.approved` | "Membership Approved" | "You've been added to {orgName}" | `/` |
| `generation.completed` | "AI Generation Ready" | "{type} completed for {project}" | `/projects/{projectId}` |

## API Integration

The API client is a configured `fetch` wrapper with automatic token injection and refresh:

### API Modules

| Module | File | Endpoints Called |
|---|---|---|
| **Auth** | `src/lib/api/auth.ts` | `POST /auth/login`, `POST /auth/register`, `POST /auth/refresh`, `POST /auth/logout` |
| **Organizations** | `src/lib/api/organizations.ts` | `GET /organizations`, `POST /organizations`, members endpoints |
| **Projects** | `src/lib/api/projects.ts` | `GET /projects`, `GET /projects/:id`, webhook endpoints |
| **Test Runs** | `src/lib/api/test-runs.ts` | `GET /test-runs`, `GET /test-runs/:id`, `POST /test-runs/:id/cancel` |

### Client Configuration

```typescript
// src/lib/api/client.ts
// - Base URL from environment
// - Automatic Authorization header injection
// - 401 interceptor triggers token refresh
// - Retry logic for network failures
```

## State Management

| Layer | Technology | Purpose |
|---|---|---|
| **Server state** | React Query (TanStack) | API data caching, background refetching, optimistic updates |
| **Client state** | Zustand | UI state (active tab, filters, user preferences) |
| **Auth state** | React Context + SecureStore | Token management, current user |

### Zustand Store

```typescript
// src/lib/stores/app-store.ts
interface AppStore {
  // Active organization context
  activeOrgId: string | null;
  setActiveOrgId: (id: string) => void;

  // UI preferences
  theme: 'light' | 'dark';
  // ... other client state
}
```

## Technology Stack

| Technology | Version | Purpose |
|---|---|---|
| Expo | ~52.0.0 | Managed React Native workflow |
| expo-router | ~4.0.0 | File-based routing |
| expo-secure-store | ~14.0.0 | Encrypted token storage |
| expo-notifications | ~0.29.0 | Push notification handling |
| React | 18.3.1 | UI framework |
| React Native | 0.76.5 | Native rendering |
| @react-navigation/native | ^7.0.0 | Navigation primitives |
| @tanstack/react-query | ^5.62.0 | Server state management |
| Zustand | ^5.0.0 | Client state management |
| Zod | ^3.23.0 | Runtime type validation |
| lucide-react-native | ^0.468.0 | Icon library |
