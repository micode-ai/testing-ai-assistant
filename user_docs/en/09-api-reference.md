# API Reference

## General Information

All API endpoints use REST and JSON. Authentication via JWT Bearer token.

**Authorization header:**
```
Authorization: Bearer <access_token>
```

**Base URLs (local development):**
- Identity: `http://localhost:3001`
- Organization: `http://localhost:3002`
- Project: `http://localhost:3003`
- Pipeline: `http://localhost:3004`
- AI: `http://localhost:3005`
- Notification: `http://localhost:3006`

**Via API Gateway (production):**
```
http://localhost/api/<service>
```

## Response Codes

| Code | Description |
|------|-------------|
| `200` | Successful request |
| `201` | Resource created |
| `400` | Bad request (validation errors) |
| `401` | Not authenticated |
| `403` | Forbidden |
| `404` | Resource not found |
| `409` | Conflict (duplicate) |
| `500` | Internal server error |

---

## Identity Service (port 3001)

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register new user |
| `POST` | `/auth/login` | Login |
| `POST` | `/auth/refresh` | Refresh access token |
| `POST` | `/auth/logout` | Logout |
| `GET` | `/auth/me` | Get current user |

#### POST /auth/register

```json
// Request
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}

// Response 201
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

#### POST /auth/login

```json
// Request
{
  "email": "john@example.com",
  "password": "securePassword123"
}

// Response 200
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

#### POST /auth/refresh

```json
// Request
{
  "refreshToken": "eyJ..."
}

// Response 200
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

### Users (Internal)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/users/batch` | Batch-resolve user IDs to profiles |

#### POST /api/v1/users/batch

Internal endpoint (no JWT required). Used by the dashboard to resolve user IDs to display names.

```json
// Request
{
  "ids": ["cuid_user_id_1", "cuid_user_id_2"]
}

// Response 200
[
  {
    "id": "cuid_user_id_1",
    "email": "alice@example.com",
    "name": "Alice",
    "avatarUrl": null,
    "createdAt": "2026-03-12T10:00:00Z"
  }
]
```

---

## Organization Service (port 3002)

### Members

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/organizations/:orgId/members/invite` | Invite member |
| `GET` | `/organizations/:orgId/members` | List members |
| `PATCH` | `/organizations/:orgId/members/:id/approve` | Approve |
| `PATCH` | `/organizations/:orgId/members/:id/reject` | Reject |
| `PATCH` | `/organizations/:orgId/members/:id/role` | Change role |
| `DELETE` | `/organizations/:orgId/members/:id` | Remove member |

#### POST /organizations/:orgId/members/invite

```json
// Request
{
  "email": "user@example.com",
  "role": "MEMBER"
}

// Response 201
{
  "id": "uuid",
  "userId": "uuid",
  "orgId": "uuid",
  "role": "MEMBER",
  "status": "PENDING"
}
```

---

## Project Service (port 3003)

### Projects

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/projects` | Create project |
| `GET` | `/projects?orgId=<id>` | List projects |
| `GET` | `/projects/:id` | Get project |
| `PATCH` | `/projects/:id` | Update project |
| `DELETE` | `/projects/:id` | Delete project |
| `POST` | `/projects/:id/webhook/connect` | Connect webhook |
| `DELETE` | `/projects/:id/webhook/disconnect` | Disconnect webhook |

#### POST /projects

```json
// Request
{
  "name": "My Project",
  "description": "Project description",
  "orgId": "uuid",
  "gitProvider": "GITHUB",
  "repoUrl": "https://github.com/org/repo",
  "defaultBranch": "main"
}

// Response 201
{
  "id": "uuid",
  "name": "My Project",
  "orgId": "uuid",
  "gitProvider": "GITHUB",
  "webhookConnected": false
}
```

---

## Pipeline Service (port 3004)

### Pipelines

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/pipelines` | Create pipeline |
| `GET` | `/pipelines?projectId=<id>` | List pipelines |
| `GET` | `/pipelines/:id` | Get pipeline |
| `PATCH` | `/pipelines/:id` | Update pipeline |
| `DELETE` | `/pipelines/:id` | Delete pipeline |
| `POST` | `/pipelines/:id/toggle` | Enable/disable |

### Test Runs

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/test-runs` | Create and trigger |
| `GET` | `/test-runs?pipelineId=<id>` | List runs |
| `GET` | `/test-runs/:id` | Run details |
| `POST` | `/test-runs/:id/cancel` | Cancel run |

#### POST /test-runs

```json
// Request
{
  "pipelineId": "uuid",
  "branch": "main",
  "commit": "abc123def"
}

// Response 201
{
  "id": "uuid",
  "pipelineId": "uuid",
  "status": "PENDING",
  "branch": "main",
  "commit": "abc123def",
  "createdAt": "2026-03-12T10:00:00Z"
}
```

---

## AI Service (port 3005)

### AI Generation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ai/generate` | Start generation |
| `GET` | `/ai/generations?projectId=<id>&type=<type>` | List generations |
| `GET` | `/ai/generations/:id` | Generation details |
| `PATCH` | `/ai/generations/:id/feedback` | Provide feedback |
| `GET` | `/ai/generations/stats?projectId=<id>` | Statistics |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ai/chat` | Send chat message (SSE stream) |
| `GET` | `/ai/chat/conversations?projectId=<id>` | List conversations |
| `GET` | `/ai/chat/conversations/:id` | Get conversation with messages |
| `DELETE` | `/ai/chat/conversations/:id` | Delete conversation |

### Knowledge Base

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/ai/knowledge/index` | Re-index documentation into knowledge base |
| `GET` | `/ai/knowledge/search?q=<query>&projectId=<id>` | Search knowledge base |

#### POST /ai/chat

```json
// Request
{
  "message": "Create a checklist for login testing",
  "projectId": "uuid",
  "conversationId": "uuid-optional"
}

// Response: SSE stream
data: {"type":"text","content":"I'll create a checklist...","conversationId":"uuid"}
data: {"type":"tool_call","content":"{\"name\":\"create_checklist\",\"args\":{...}}","conversationId":"uuid"}
data: {"type":"tool_result","content":"{\"name\":\"create_checklist\",\"result\":\"{...}\"}","conversationId":"uuid"}
data: {"type":"text","content":"Done! I've created...","conversationId":"uuid"}
data: {"type":"done","content":"","conversationId":"uuid"}
```

#### POST /ai/generate

```json
// Request
{
  "projectId": "uuid",
  "type": "TEST_GENERATION"
}

// Response 201
{
  "id": "uuid",
  "projectId": "uuid",
  "type": "TEST_GENERATION",
  "status": "PROCESSING",
  "createdAt": "2026-03-12T10:00:00Z"
}
```

---

## Notification Service (port 3006)

### Notification Configurations

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/notifications/configs` | Create configuration |
| `GET` | `/notifications/configs?orgId=<id>` | List configurations |
| `GET` | `/notifications/configs/:id` | Get configuration |
| `PATCH` | `/notifications/configs/:id` | Update configuration |
| `DELETE` | `/notifications/configs/:id` | Delete configuration |

---

## Health Check (all services)

```
GET /health → 200 OK
```
