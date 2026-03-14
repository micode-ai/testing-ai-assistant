# Security

## Overview

Security is implemented in layers: TLS termination at the gateway, JWT-based authentication, role-based authorization, secrets management, and secure coding practices.

```mermaid
flowchart TD
    Client["Client<br/>(Browser / Mobile)"]
    Client --> TLS["TLS Termination<br/>(Traefik + Let's Encrypt)"]
    TLS --> RateLimit["Rate Limiting<br/>(Traefik middleware)"]
    RateLimit --> CORS["CORS Headers<br/>(Traefik middleware)"]
    CORS --> JWTValidation["JWT Validation<br/>(Traefik middleware or service guard)"]
    JWTValidation --> Service["Microservice"]
    Service --> RoleCheck["Role-Based Authorization<br/>(OrgMemberGuard)"]
    RoleCheck --> DB["Database<br/>(Encrypted at rest)"]
```

## Authentication Flow

### Keycloak + JWT Architecture

```mermaid
sequenceDiagram
    participant Client
    participant Traefik as Traefik Gateway
    participant Identity as Identity Service
    participant Keycloak
    participant Redis

    Note over Client,Keycloak: Registration / Login
    Client->>Traefik: POST /api/identity/auth/login
    Traefik->>Identity: Forward (no JWT middleware on auth routes)
    Identity->>Identity: Verify credentials
    Identity->>Identity: Generate JWT (signed with JWT_SECRET)
    Identity->>Keycloak: Sync user (optional SSO)
    Identity-->>Client: {accessToken, refreshToken}

    Note over Client,Redis: Authenticated Request
    Client->>Traefik: GET /api/pipeline/pipelines<br/>Authorization: Bearer <jwt>
    Traefik->>Traefik: JWT middleware validates token
    Traefik->>Identity: Forward request
    Identity->>Identity: JwtAuthGuard extracts payload

    Note over Client,Redis: Token Refresh
    Client->>Identity: POST /auth/refresh {refreshToken}
    Identity->>Identity: Validate and rotate tokens
    Identity-->>Client: {new accessToken, new refreshToken}

    Note over Client,Redis: Logout
    Client->>Identity: POST /auth/logout {refreshToken}
    Identity->>Redis: Add token to blacklist (optional)
    Identity->>Identity: Revoke refresh token in DB
```

### Token Lifecycle

| Token | Lifetime | Storage (Client) | Revocation |
|---|---|---|---|
| **Access Token (JWT)** | 1 hour | Memory / HttpOnly cookie | Expires naturally; blacklist via Redis for forced revocation |
| **Refresh Token** | 7 days | Secure storage (SecureStore on mobile, HttpOnly cookie on web) | Revoked in database (revokedAt field) |

## Authorization Model

### Role Hierarchy

```mermaid
graph TD
    ADMIN["ADMIN<br/>Full control over organization"]
    MEMBER["MEMBER<br/>Read + write access to projects and pipelines"]
    VIEWER["VIEWER<br/>Read-only access"]

    ADMIN -->|"inherits"| MEMBER
    MEMBER -->|"inherits"| VIEWER
```

### Guard Chain

Every authenticated request passes through a chain of guards:

```mermaid
flowchart LR
    Request["Request"] --> JwtGuard["JwtAuthGuard<br/>1. Extract Bearer token<br/>2. Verify signature<br/>3. Check expiration<br/>4. Attach payload to request"]
    JwtGuard --> OrgGuard["OrgMemberGuard<br/>1. Extract orgId from route<br/>2. Query membership<br/>3. Check status = APPROVED<br/>4. Check role against @Roles()"]
    OrgGuard --> Handler["Route Handler"]

    JwtGuard -- "Invalid token" --> R401["401 Unauthorized"]
    OrgGuard -- "Not member / wrong role" --> R403["403 Forbidden"]
```

### Permission Matrix

| Resource | ADMIN | MEMBER | VIEWER | Public |
|---|---|---|---|---|
| Register / Login | - | - | - | Yes |
| View organization | Yes | Yes | Yes | No |
| Manage members | Yes | No | No | No |
| Create project | Yes | Yes | No | No |
| View project | Yes | Yes | Yes | No |
| Manage pipelines | Yes | Yes | No | No |
| View test runs | Yes | Yes | Yes | No |
| Trigger test runs | Yes | Yes | No | No |
| AI generations | Yes | Yes | No | No |
| Notification configs | Yes | No | No | No |

## Traefik Security Middlewares

The Traefik API gateway applies several security middlewares to incoming requests.

### Rate Limiting

```yaml
# Auth endpoints: stricter rate limiting
rate-limit-auth:
  rateLimit:
    average: 20
    burst: 10
    period: 1m

# General API endpoints
rate-limit-global:
  rateLimit:
    average: 100
    burst: 50
    period: 1m
```

| Route Pattern | Rate Limit | Burst | Period |
|---|---|---|---|
| `/api/identity/auth/*` | 20 req | 10 | 1 minute |
| All other `/api/*` | 100 req | 50 | 1 minute |

### CORS Headers

```yaml
cors-headers:
  headers:
    accessControlAllowOriginList:
      - "https://app.testing-ai.example.com"
      - "http://localhost:4200"
    accessControlAllowMethods:
      - GET
      - POST
      - PATCH
      - DELETE
      - OPTIONS
    accessControlAllowHeaders:
      - Authorization
      - Content-Type
    accessControlMaxAge: 86400
```

### JWT Validation Middleware

```yaml
jwt-auth:
  plugin:
    jwt:
      secret: "${JWT_SECRET}"
      alg: HS256
      headerName: Authorization
      headerPrefix: "Bearer "
```

This middleware validates the JWT signature at the gateway level before forwarding requests to services. The Identity Service route (`/api/identity`) does not use this middleware because it includes public endpoints (login, register, refresh).

### Security Headers

```yaml
security-headers:
  headers:
    frameDeny: true
    browserXssFilter: true
    contentTypeNosniff: true
    stsSeconds: 31536000
    stsIncludeSubdomains: true
    stsPreload: true
    referrerPolicy: "strict-origin-when-cross-origin"
    contentSecurityPolicy: "default-src 'self'"
```

### Compression

```yaml
compression:
  compress:
    excludedContentTypes:
      - text/event-stream
```

SSE connections are excluded from compression to ensure real-time delivery.

## TLS Configuration

### Development

TLS is not used in development. All communication is over HTTP on localhost.

### Staging / Production

Traefik handles TLS termination with Let's Encrypt certificates:

```yaml
# traefik static configuration
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@testing-ai.example.com
      storage: /acme/acme.json
      httpChallenge:
        entryPoint: web
```

All HTTP traffic is redirected to HTTPS. Certificates are automatically provisioned and renewed.

## Vault Secrets Management

In production, secrets are managed by HashiCorp Vault with the External Secrets Operator syncing secrets to Kubernetes.

```mermaid
flowchart LR
    Vault["HashiCorp Vault<br/>(Secrets Source)"]
    ESO["External Secrets<br/>Operator"]
    K8sSecret["Kubernetes Secret"]
    Pod["Service Pod"]

    Vault --> ESO
    ESO --> K8sSecret
    K8sSecret --> Pod
```

### Managed Secrets

| Secret | Service | Description |
|---|---|---|
| `JWT_SECRET` | Identity | JWT signing key |
| `*_DB_URL` | All services | Database connection strings with credentials |
| `OPENAI_API_KEY` | AI | OpenAI API key |
| `GITHUB_CLIENT_SECRET` | Identity | GitHub OAuth secret |
| `GITLAB_CLIENT_SECRET` | Identity | GitLab OAuth secret |
| `BITBUCKET_CLIENT_SECRET` | Identity | Bitbucket OAuth secret |
| `SMTP_PASS` | Notification | SMTP password |
| `SLACK_BOT_TOKEN` | Notification | Slack bot token |
| `TELEGRAM_BOT_TOKEN` | Notification | Telegram bot token |
| `MINIO_SECRET_KEY` | Test Runner | MinIO secret key |
| `NEXTAUTH_SECRET` | Dashboard | NextAuth encryption secret |

## OWASP Considerations

| OWASP Top 10 | Mitigation |
|---|---|
| **A01: Broken Access Control** | JWT + OrgMemberGuard with role-based checks on every endpoint |
| **A02: Cryptographic Failures** | bcrypt for passwords, JWT HS256 signing, TLS for transit, encrypted DB at rest |
| **A03: Injection** | Prisma ORM with parameterized queries; input validation via class-validator DTOs |
| **A04: Insecure Design** | Database-per-service isolation; principle of least privilege for roles |
| **A05: Security Misconfiguration** | Security headers via Traefik; no default credentials in production (Vault) |
| **A06: Vulnerable Components** | Dependency audit step in test pipelines; automated `dep_audit` check type |
| **A07: Auth Failures** | Rate limiting on auth endpoints; refresh token rotation; token blacklisting |
| **A08: Software/Data Integrity** | Webhook signature verification; signed Docker images; ArgoCD git source of truth |
| **A09: Logging Failures** | Structured logging with OTel; audit trail via notification logs |
| **A10: SSRF** | Git adapter validates repository URLs; no user-controlled outbound HTTP |

## Password Security

| Aspect | Implementation |
|---|---|
| **Hashing** | bcrypt with auto-generated salt (cost factor 10) |
| **Storage** | `passwordHash` field in User model; null for OAuth-only users |
| **Validation** | Minimum length, complexity rules enforced by DTO validation |
| **Comparison** | Constant-time bcrypt compare to prevent timing attacks |
