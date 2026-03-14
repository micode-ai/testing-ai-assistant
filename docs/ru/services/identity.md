# Identity Service — Сервис идентификации

## Общие сведения

| Параметр | Значение |
|----------|----------|
| **Назначение** | Аутентификация, регистрация, управление пользователями и OAuth-аккаунтами |
| **Порт** | 3001 |
| **БД** | `identity_db` (PostgreSQL :5441) |
| **Фреймворк** | NestJS |
| **ORM** | Prisma |
| **Маршрут Gateway** | `/api/identity` |

## Prisma-схема

### Модели

```
User
├── id: String (cuid)
├── email: String (unique)
├── name: String
├── passwordHash: String?
├── avatarUrl: String?
├── keycloakId: String? (unique)
├── createdAt / updatedAt / deletedAt
├── oauthAccounts: OAuthAccount[]
└── refreshTokens: RefreshToken[]

OAuthAccount
├── id: String (cuid)
├── provider: OAuthProvider (GITHUB | GITLAB | BITBUCKET)
├── providerUserId: String
├── accessToken: String
├── refreshToken: String?
├── expiresAt: DateTime?
├── userId → User
└── @@unique([provider, providerUserId])

RefreshToken
├── id: String (cuid)
├── token: String (unique)
├── expiresAt: DateTime
├── revokedAt: DateTime?
└── userId: String
```

### Перечисления

| Enum | Значения |
|------|---------|
| `OAuthProvider` | `GITHUB`, `GITLAB`, `BITBUCKET` |

## API-эндпоинты

| Метод | Путь | Авторизация | Описание |
|-------|------|-------------|----------|
| `POST` | `/auth/register` | Публичный | Регистрация нового пользователя |
| `POST` | `/auth/login` | Публичный | Вход по email/password |
| `POST` | `/auth/refresh` | Публичный | Обновление пары токенов |
| `POST` | `/auth/logout` | Bearer JWT | Выход и отзыв refresh token |
| `GET` | `/auth/me` | Bearer JWT | Получение текущего пользователя |

## Потоки аутентификации

### Регистрация

```mermaid
sequenceDiagram
    participant C as Клиент
    participant ID as Identity Service
    participant DB as identity_db
    participant KC as Keycloak

    C->>ID: POST /auth/register<br/>{email, name, password}
    ID->>DB: Проверка: email уже существует?
    alt Email занят
        ID-->>C: 409 Conflict
    else Email свободен
        ID->>ID: Хэширование пароля (bcrypt)
        ID->>DB: Создание User
        ID->>KC: Создание пользователя в Keycloak
        ID->>ID: Генерация JWT access token
        ID->>DB: Создание RefreshToken
        ID-->>C: 201 {accessToken, refreshToken, user}
    end
```

### Логин

```mermaid
sequenceDiagram
    participant C as Клиент
    participant ID as Identity Service
    participant DB as identity_db

    C->>ID: POST /auth/login<br/>{email, password}
    ID->>DB: Найти User по email
    alt Пользователь не найден
        ID-->>C: 401 Unauthorized
    else Пользователь найден
        ID->>ID: Проверка пароля (bcrypt.compare)
        alt Пароль неверный
            ID-->>C: 401 Unauthorized
        else Пароль верный
            ID->>ID: Генерация JWT access token
            ID->>DB: Создание RefreshToken
            ID-->>C: 200 {accessToken, refreshToken, user}
        end
    end
```

### OAuth (GitHub/GitLab/Bitbucket)

```mermaid
sequenceDiagram
    participant C as Клиент
    participant KC as Keycloak
    participant OP as OAuth Provider<br/>(GitHub/GitLab/Bitbucket)
    participant ID as Identity Service
    participant DB as identity_db

    C->>KC: Перенаправление на /auth/realms/testing-ai/protocol/openid-connect/auth
    KC->>OP: Перенаправление на OAuth Provider
    OP->>OP: Пользователь авторизует доступ
    OP->>KC: Authorization code
    KC->>OP: Обмен code на token
    KC->>KC: Создание/обновление пользователя
    KC->>C: Redirect с code
    C->>ID: POST /auth/oauth/callback<br/>{provider, code}
    ID->>DB: Найти/создать User + OAuthAccount
    ID->>DB: Сохранить accessToken/refreshToken провайдера
    ID->>ID: Генерация JWT
    ID-->>C: 200 {accessToken, refreshToken, user}
```

### Обновление токена

```mermaid
sequenceDiagram
    participant C as Клиент
    participant ID as Identity Service
    participant DB as identity_db

    C->>ID: POST /auth/refresh<br/>{refreshToken}
    ID->>DB: Найти RefreshToken по значению
    alt Токен не найден или отозван
        ID-->>C: 401 Unauthorized
    else Токен действителен
        alt Токен истёк
            ID-->>C: 401 Token expired
        else Токен актуален
            ID->>DB: Отозвать старый RefreshToken (revokedAt = now)
            ID->>ID: Генерация нового JWT access token
            ID->>DB: Создание нового RefreshToken
            ID-->>C: 200 {accessToken, refreshToken}
        end
    end
```

## Структура JWT-токена

### Access Token (Header)

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

### Access Token (Payload)

```json
{
  "sub": "clu1234567890",
  "email": "user@example.com",
  "name": "User Name",
  "iat": 1710000000,
  "exp": 1710003600
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `sub` | `string` | ID пользователя (User.id) |
| `email` | `string` | Email пользователя |
| `name` | `string` | Имя пользователя |
| `iat` | `number` | Время создания (Unix timestamp) |
| `exp` | `number` | Время истечения (по умолчанию +1h) |

### Refresh Token

Refresh token хранится в БД как уникальная строка (UUID или случайный токен) со сроком действия 7 дней.

## Guards и декораторы

### JwtAuthGuard

Guard для защиты маршрутов, требующих аутентификации. Извлекает JWT из заголовка `Authorization: Bearer <token>`, валидирует подпись и срок действия.

```typescript
@UseGuards(JwtAuthGuard)
```

### @Public()

Декоратор для маршрутов, доступных без аутентификации (регистрация, логин, обновление токена).

```typescript
@Public()
@Post('register')
async register(@Body() dto: RegisterDto) { ... }
```

### @CurrentUser()

Декоратор для извлечения данных текущего пользователя из JWT payload.

```typescript
@Get('me')
async me(@CurrentUser() user: JwtPayload) { ... }

// Или конкретное поле:
@Post()
async create(@CurrentUser('sub') userId: string) { ... }
```

## Конфигурация

| Параметр | Переменная окружения | По умолчанию |
|----------|---------------------|-------------|
| Порт | `IDENTITY_PORT` | 3001 |
| БД | `IDENTITY_DB_URL` | `postgresql://postgres:postgres@localhost:5441/identity_db` |
| JWT секрет | `JWT_SECRET` | `super-secret-dev-key-change-in-production` |
| JWT TTL | `JWT_EXPIRATION` | `1h` |
| Refresh TTL | `JWT_REFRESH_EXPIRATION` | `7d` |
| Keycloak URL | `KEYCLOAK_URL` | `http://localhost:8180` |
| Keycloak Realm | `KEYCLOAK_REALM` | `testing-ai` |
