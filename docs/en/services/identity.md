# Identity Service

## Overview

| Property | Value |
|---|---|
| **Purpose** | User authentication, registration, OAuth, and JWT token management |
| **Port** | 3001 |
| **Database** | `identity_db` (PostgreSQL, port 5441) |
| **Framework** | NestJS |
| **Gateway Route** | `/api/identity/*` |

## Prisma Schema

```prisma
enum OAuthProvider {
  GITHUB
  GITLAB
  BITBUCKET
}

model User {
  id           String    @id @default(cuid())
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?

  email        String    @unique
  name         String
  passwordHash String?
  avatarUrl    String?
  keycloakId   String?   @unique

  oauthAccounts OAuthAccount[]
  refreshTokens RefreshToken[]
}

model OAuthAccount {
  id             String        @id @default(cuid())
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  deletedAt      DateTime?

  provider       OAuthProvider
  providerUserId String
  accessToken    String
  refreshToken   String?
  expiresAt      DateTime?

  userId         String
  user           User          @relation(fields: [userId], references: [id])

  @@unique([provider, providerUserId])
}

model RefreshToken {
  id        String    @id @default(cuid())
  createdAt DateTime  @default(now())

  token     String    @unique
  expiresAt DateTime
  revokedAt DateTime?

  userId    String
}
```

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register a new user |
| `POST` | `/auth/login` | Public | Login with email and password |
| `POST` | `/auth/refresh` | Public | Refresh access token using refresh token |
| `POST` | `/auth/logout` | Bearer JWT | Logout and revoke refresh token |
| `GET` | `/auth/me` | Bearer JWT | Get current authenticated user profile |

## Authentication Flows

### Registration Flow

```mermaid
sequenceDiagram
    actor User
    participant Dashboard
    participant Identity as Identity Service
    participant DB as PostgreSQL
    participant KC as Keycloak

    User->>Dashboard: Fill registration form
    Dashboard->>Identity: POST /auth/register<br/>{email, name, password}
    Identity->>DB: Check email uniqueness
    alt Email already exists
        DB-->>Identity: Conflict
        Identity-->>Dashboard: 409 Email already registered
    else Email available
        Identity->>Identity: Hash password (bcrypt)
        Identity->>DB: Create User record
        Identity->>KC: Create Keycloak user (optional)
        Identity->>Identity: Generate JWT + Refresh Token
        Identity->>DB: Store RefreshToken
        Identity-->>Dashboard: 201 {accessToken, refreshToken, user}
        Dashboard->>Dashboard: Store tokens
        Dashboard-->>User: Redirect to /organizations
    end
```

### Login Flow

```mermaid
sequenceDiagram
    actor User
    participant Dashboard
    participant Identity as Identity Service
    participant DB as PostgreSQL
    participant Redis

    User->>Dashboard: Enter email & password
    Dashboard->>Identity: POST /auth/login<br/>{email, password}
    Identity->>DB: Find user by email
    alt User not found
        Identity-->>Dashboard: 401 Invalid credentials
    else User found
        Identity->>Identity: Verify password (bcrypt compare)
        alt Password mismatch
            Identity-->>Dashboard: 401 Invalid credentials
        else Password matches
            Identity->>Identity: Generate JWT (sub, email, name)
            Identity->>Identity: Generate Refresh Token
            Identity->>DB: Store RefreshToken
            Identity-->>Dashboard: 200 {accessToken, refreshToken, user}
            Dashboard->>Dashboard: Store tokens in session
            Dashboard-->>User: Redirect to dashboard
        end
    end
```

### OAuth Flow (GitHub / GitLab / Bitbucket)

```mermaid
sequenceDiagram
    actor User
    participant Dashboard
    participant Provider as OAuth Provider<br/>(GitHub/GitLab/Bitbucket)
    participant Identity as Identity Service
    participant DB as PostgreSQL

    User->>Dashboard: Click "Sign in with GitHub"
    Dashboard->>Provider: Redirect to OAuth authorize URL
    User->>Provider: Grant permissions
    Provider->>Dashboard: Redirect with authorization code
    Dashboard->>Identity: POST /auth/oauth<br/>{provider, code}
    Identity->>Provider: Exchange code for access token
    Provider-->>Identity: {access_token, user_info}
    Identity->>DB: Find OAuthAccount by provider + providerUserId
    alt Existing account
        Identity->>DB: Update access token
        Identity->>DB: Load linked User
    else New account
        Identity->>DB: Create User
        Identity->>DB: Create OAuthAccount linked to User
    end
    Identity->>Identity: Generate JWT + Refresh Token
    Identity->>DB: Store RefreshToken
    Identity-->>Dashboard: 200 {accessToken, refreshToken, user}
```

### Token Refresh Flow

```mermaid
sequenceDiagram
    participant Dashboard
    participant Identity as Identity Service
    participant DB as PostgreSQL

    Dashboard->>Identity: POST /auth/refresh<br/>{refreshToken}
    Identity->>DB: Find RefreshToken by token
    alt Token not found or revoked
        Identity-->>Dashboard: 401 Invalid refresh token
    else Token valid
        Identity->>Identity: Check expiration
        alt Token expired
            Identity-->>Dashboard: 401 Refresh token expired
        else Token not expired
            Identity->>DB: Revoke old RefreshToken (set revokedAt)
            Identity->>Identity: Generate new JWT
            Identity->>Identity: Generate new RefreshToken
            Identity->>DB: Store new RefreshToken
            Identity-->>Dashboard: 200 {accessToken, refreshToken}
        end
    end
```

## JWT Token Structure

The access token is a signed JWT with the following payload:

```json
{
  "sub": "cuid_user_id",
  "email": "user@example.com",
  "name": "User Name",
  "iat": 1700000000,
  "exp": 1700003600
}
```

| Claim | Description |
|---|---|
| `sub` | User ID (CUID) |
| `email` | User email address |
| `name` | User display name |
| `iat` | Issued-at timestamp |
| `exp` | Expiration timestamp (default: 1 hour after issuance) |

## Guards and Decorators

### `JwtAuthGuard`

A NestJS guard that validates the `Authorization: Bearer <token>` header. Applied globally to all routes unless overridden by `@Public()`.

### `@Public()`

Decorator that marks a route as publicly accessible, bypassing JWT authentication. Used on `/auth/register`, `/auth/login`, and `/auth/refresh`.

### `@CurrentUser()`

Parameter decorator that extracts the JWT payload from the request. Returns a `JwtPayload` object with `sub`, `email`, and `name` fields.

```typescript
@Get('me')
@UseGuards(JwtAuthGuard)
async me(@CurrentUser() user: JwtPayload): Promise<UserResponseDto> {
  const found = await this.userService.findById(user.sub);
  return UserResponseDto.fromEntity(found);
}
```
