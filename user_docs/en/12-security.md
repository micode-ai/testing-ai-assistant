# Security

## Authentication

### JWT Tokens

The system uses JWT for stateless authentication:

- **Access Token** — short-lived (default 1 hour)
- **Refresh Token** — long-lived (default 7 days)

```env
JWT_SECRET=your-secret-key     # Must change in production!
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d
```

### Authentication Flow

1. User sends login/password to `POST /auth/login`
2. Server validates credentials and returns a token pair
3. Client sends access token in `Authorization: Bearer <token>` header
4. When access token expires, client refreshes via `POST /auth/refresh`
5. On logout, refresh token is added to blacklist (Redis)

### Token Blacklist

Revoked tokens are stored in Redis with a TTL equal to the token's lifetime. Each request checks whether the token is blacklisted.

### OAuth2

Supported providers:

| Provider | Endpoint |
|----------|----------|
| GitHub | `/auth/github`, `/auth/github/callback` |
| GitLab | `/auth/gitlab`, `/auth/gitlab/callback` |
| Bitbucket | `/auth/bitbucket`, `/auth/bitbucket/callback` |

Configuration:

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITLAB_CLIENT_ID=...
GITLAB_CLIENT_SECRET=...
BITBUCKET_CLIENT_ID=...
BITBUCKET_CLIENT_SECRET=...
```

### Keycloak (optional)

For enterprise SSO, Keycloak can be integrated:

- Access: http://localhost:8180
- Identity Service syncs users with Keycloak
- OIDC/SAML protocol support

## Authorization

### RBAC (Role-Based Access Control)

Roles are defined at the organization level:

| Role | Permissions |
|------|-------------|
| `ADMIN` | Full access: manage members, settings, deletion |
| `MEMBER` | Work with projects, pipelines, run tests |
| `VIEWER` | Read-only: view projects and results |

### Guards (NestJS)

Each endpoint is protected by NestJS Guards:

- **JwtAuthGuard** — JWT token verification
- **RolesGuard** — user role verification
- **OrgMemberGuard** — organization membership verification

## Password Storage

- Passwords are hashed via `bcryptjs` with salt rounds = 10
- Original passwords are never stored
- Verification uses `bcrypt.compare()`

## API Security

### Input Validation

All inputs are validated through:

- `class-validator` — validation decorators on DTOs
- `class-transformer` — transformation and sanitization
- `zod` — schema validation (Dashboard)

### Rate Limiting

Traefik provides rate limiting at the API Gateway level:

- Request limiting by IP
- Limiting by user (via JWT)

### CORS

CORS settings are defined in each service:

```typescript
app.enableCors({
  origin: ['http://localhost:4200'],
  credentials: true,
});
```

### Helmet

Security HTTP headers via Helmet middleware.

## TLS

### Local Development

TLS is not used in local development (HTTP).

### Production

Traefik provides TLS termination:

```yaml
# infrastructure/traefik/traefik.yml
entryPoints:
  websecure:
    address: ":443"
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@yourdomain.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

## Data Security

### Databases

- Each service has an isolated database (database-per-service)
- SSL connections in production
- Credentials stored in Kubernetes Secrets

### Secrets

- Local: `.env` file (do not commit!)
- Kubernetes: `Secret` resources
- Recommended: HashiCorp Vault or AWS Secrets Manager

### Artifacts (MinIO)

- Access via pre-signed URLs with limited TTL
- Bucket policies for access control

## Production Recommendations

1. **Change all secrets** — JWT_SECRET, NEXTAUTH_SECRET, DB passwords
2. **Enable TLS** — via Traefik or cloud load balancer
3. **Configure CORS** — restrict allowed origins
4. **Enable rate limiting** — DDoS protection
5. **Set up audit logs** — track user actions
6. **Update dependencies** — regular security patches
7. **Use network policies** — restrict inter-service communication
8. **Encrypt data** — encryption at rest for databases
