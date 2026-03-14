# API Reference

## Base URLs

| Environment | Base URL |
|---|---|
| Development (direct) | `http://localhost:<service-port>` |
| Development (gateway) | `http://localhost/api/<service>` |
| Production (gateway) | `https://api.testing-ai.example.com/api/<service>` |

## Authentication

All endpoints (except those marked Public) require a JWT Bearer token:

```
Authorization: Bearer <access_token>
```

Obtain tokens via `POST /auth/login` or `POST /auth/register`.

---

## Identity Service (port 3001)

Gateway prefix: `/api/identity`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register a new user |
| `POST` | `/auth/login` | Public | Login with email and password |
| `POST` | `/auth/refresh` | Public | Refresh access token |
| `POST` | `/auth/logout` | Bearer JWT | Logout and revoke refresh token |
| `GET` | `/auth/me` | Bearer JWT | Get current authenticated user |

### Request/Response Examples

**POST /auth/register**
```json
// Request
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "SecureP@ss123"
}

// Response (201)
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "cuid_refresh_token_value",
  "user": {
    "id": "cuid_user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": null
  }
}
```

**POST /auth/login**
```json
// Request
{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}

// Response (200)
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "cuid_refresh_token_value",
  "user": {
    "id": "cuid_user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": null
  }
}
```

---

## Organization Service (port 3002)

Gateway prefix: `/api/org`

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/organizations/:orgId/members/invite` | Bearer JWT | ADMIN | Invite a member |
| `GET` | `/organizations/:orgId/members` | Bearer JWT | Any | List organization members |
| `PATCH` | `/organizations/:orgId/members/:memberId/approve` | Bearer JWT | ADMIN | Approve a pending membership |
| `PATCH` | `/organizations/:orgId/members/:memberId/reject` | Bearer JWT | ADMIN | Reject a pending membership |
| `PATCH` | `/organizations/:orgId/members/:memberId/role` | Bearer JWT | ADMIN | Change member role |
| `DELETE` | `/organizations/:orgId/members/:memberId` | Bearer JWT | ADMIN | Remove a member |

---

## Project Service (port 3003)

Gateway prefix: `/api/project`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/projects` | Bearer JWT | Create a new project |
| `GET` | `/projects?orgId=<orgId>` | Bearer JWT | List projects by organization |
| `GET` | `/projects/:id` | Bearer JWT | Get project by ID |
| `PATCH` | `/projects/:id` | Bearer JWT | Update a project |
| `DELETE` | `/projects/:id` | Bearer JWT | Soft delete a project |
| `POST` | `/projects/:id/webhook/connect` | Bearer JWT | Connect webhook |
| `DELETE` | `/projects/:id/webhook/disconnect` | Bearer JWT | Disconnect webhook |

---

## Pipeline Service (port 3004)

Gateway prefix: `/api/pipeline`

### Pipelines

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/pipelines` | Bearer JWT | Create a new pipeline |
| `GET` | `/pipelines?projectId=<id>` | Bearer JWT | List pipelines (optionally by project) |
| `GET` | `/pipelines/:id` | Bearer JWT | Get pipeline by ID |
| `PATCH` | `/pipelines/:id` | Bearer JWT | Update pipeline |
| `DELETE` | `/pipelines/:id` | Bearer JWT | Delete pipeline |
| `POST` | `/pipelines/:id/toggle` | Bearer JWT | Toggle enabled/disabled |

### Test Runs

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/test-runs` | Bearer JWT | Create and trigger a test run |
| `GET` | `/test-runs?pipelineId=<id>` | Bearer JWT | List test runs for a pipeline |
| `GET` | `/test-runs/:id` | Bearer JWT | Get test run with results |
| `POST` | `/test-runs/:id/cancel` | Bearer JWT | Cancel a test run |

---

## AI Service (port 3005)

Gateway prefix: `/api/ai`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/ai/generate` | Bearer JWT | Trigger an AI generation |
| `GET` | `/ai/generations?projectId=<id>&type=<type>` | Bearer JWT | List generations for a project |
| `GET` | `/ai/generations/stats?projectId=<id>` | Bearer JWT | Get generation statistics |
| `GET` | `/ai/generations/:id` | Bearer JWT | Get generation details |
| `PATCH` | `/ai/generations/:id/feedback` | Bearer JWT | Accept/reject with feedback |

---

## Notification Service (port 3006)

Gateway prefix: `/api/notifications`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/notifications/configs` | Bearer JWT | Create notification config |
| `GET` | `/notifications/configs?orgId=<id>` | Bearer JWT | List configs by organization |
| `GET` | `/notifications/configs/:id` | Bearer JWT | Get config by ID |
| `PATCH` | `/notifications/configs/:id` | Bearer JWT | Update config |
| `DELETE` | `/notifications/configs/:id` | Bearer JWT | Delete config |

---

## Common Response Formats

### Success Response

```json
{
  "id": "uuid-or-cuid",
  "field1": "value1",
  "field2": "value2",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

### List Response

```json
[
  { "id": "item-1", ... },
  { "id": "item-2", ... }
]
```

### Error Response

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

## Error Codes

| HTTP Code | Meaning | Common Causes |
|---|---|---|
| `400` | Bad Request | Validation failed, missing required fields |
| `401` | Unauthorized | Missing or invalid JWT token |
| `403` | Forbidden | Insufficient role/permissions |
| `404` | Not Found | Resource does not exist |
| `409` | Conflict | Duplicate resource (email, membership, project URL) |
| `422` | Unprocessable Entity | Semantically invalid request |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server error |

## Pagination

List endpoints that support pagination use query parameters:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number (1-based) |
| `limit` | integer | `20` | Items per page (max 100) |
| `sortBy` | string | `createdAt` | Field to sort by |
| `sortOrder` | string | `desc` | Sort direction (`asc` or `desc`) |

Paginated responses include metadata:

```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Rate Limiting

Rate limits are enforced at the Traefik gateway level:

| Route | Limit | Window |
|---|---|---|
| `/api/identity/auth/*` | 20 requests | per minute |
| All other `/api/*` routes | 100 requests | per minute |

When rate-limited, the API returns `429 Too Many Requests` with a `Retry-After` header.
