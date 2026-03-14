# Project Service

## Overview

| Property | Value |
|---|---|
| **Purpose** | Project management, git repository integration, webhook lifecycle |
| **Port** | 3003 |
| **Database** | `project_db` (PostgreSQL, port 5437) |
| **Framework** | NestJS |
| **Gateway Route** | `/api/project/*` |

## Prisma Schema

```prisma
enum RepoProvider {
  GITHUB
  GITLAB
  BITBUCKET
}

model Project {
  id            String       @id @default(uuid())
  orgId         String
  name          String
  repoUrl       String
  repoProvider  RepoProvider
  repoOwner     String
  repoName      String
  defaultBranch String       @default("main")
  webhookId     String?
  webhookSecret String?
  settings      Json         @default("{}")
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  deletedAt     DateTime?

  @@unique([orgId, repoUrl])
}
```

## API Endpoints

All endpoints require `Bearer JWT` authentication.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/projects` | Bearer JWT | Create a new project |
| `GET` | `/projects?orgId=<orgId>` | Bearer JWT | List projects by organization |
| `GET` | `/projects/:id` | Bearer JWT | Get project by ID |
| `PATCH` | `/projects/:id` | Bearer JWT | Update a project |
| `DELETE` | `/projects/:id` | Bearer JWT | Soft delete a project |
| `POST` | `/projects/:id/webhook/connect` | Bearer JWT | Connect webhook for a project |
| `DELETE` | `/projects/:id/webhook/disconnect` | Bearer JWT | Disconnect webhook for a project |

## Webhook Setup Flow

```mermaid
sequenceDiagram
    actor User
    participant Dashboard
    participant ProjectService as Project Service
    participant GitAdapter as git-adapter
    participant GitProvider as GitHub / GitLab / Bitbucket
    participant DB as PostgreSQL

    User->>Dashboard: Click "Connect Webhook"
    Dashboard->>ProjectService: POST /projects/:id/webhook/connect
    ProjectService->>DB: Load project (repoProvider, repoOwner, repoName)
    ProjectService->>ProjectService: Generate webhook secret (crypto.randomBytes)
    ProjectService->>GitAdapter: createWebhook(owner, repo, callbackUrl, secret, events)
    GitAdapter->>GitProvider: POST /repos/:owner/:repo/hooks
    GitProvider-->>GitAdapter: {id, url, events, active}
    GitAdapter-->>ProjectService: WebhookInfo
    ProjectService->>DB: Update project (webhookId, webhookSecret)
    ProjectService-->>Dashboard: 200 ProjectResponse (webhook connected)
    Dashboard-->>User: Show "Webhook Active" status
```

## Webhook Event Processing Flow

```mermaid
sequenceDiagram
    participant GitProvider as GitHub / GitLab / Bitbucket
    participant ProjectService as Project Service
    participant GitAdapter as git-adapter
    participant DB as PostgreSQL
    participant Redpanda

    GitProvider->>ProjectService: POST /webhooks/:provider<br/>X-Hub-Signature / X-Gitlab-Token
    ProjectService->>DB: Find project by webhook config
    ProjectService->>GitAdapter: verifyWebhookSignature(payload, signature, secret)
    alt Signature invalid
        ProjectService-->>GitProvider: 401 Unauthorized
    else Signature valid
        ProjectService->>GitAdapter: Parse event (push, pull_request, etc.)
        GitAdapter-->>ProjectService: Parsed event with commitSha, branch, etc.
        ProjectService->>Redpanda: Emit "pipeline.trigger"<br/>{projectId, commitSha, branch, trigger}
        ProjectService-->>GitProvider: 200 OK
    end
```

## git-adapter Package

The `@testing-ai/git-adapter` package provides a unified interface for interacting with multiple git hosting providers. It abstracts away the differences between GitHub, GitLab, and Bitbucket APIs behind a common `GitProvider` interface.

### GitProvider Interface

```typescript
export interface GitProvider {
  getRepository(owner: string, repo: string): Promise<RepoInfo>;
  getBranches(owner: string, repo: string): Promise<Branch[]>;
  getCommit(owner: string, repo: string, sha: string): Promise<CommitInfo>;
  getDiff(owner: string, repo: string, base: string, head: string): Promise<string>;
  getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string>;
  createWebhook(owner: string, repo: string, url: string, secret: string, events: string[]): Promise<WebhookInfo>;
  deleteWebhook(owner: string, repo: string, webhookId: string): Promise<void>;
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  listPullRequests(owner: string, repo: string, state?: 'open' | 'closed' | 'all'): Promise<PullRequest[]>;
  createCommitStatus(owner: string, repo: string, sha: string, status: CommitStatusInput): Promise<void>;
}
```

### Provider Comparison

| Feature | GitHub | GitLab | Bitbucket |
|---|---|---|---|
| **API Base URL** | `api.github.com` | `gitlab.com/api/v4` | `api.bitbucket.org/2.0` |
| **Webhook Signature** | HMAC-SHA256 (`X-Hub-Signature-256`) | Secret token (`X-Gitlab-Token`) | HMAC-SHA256 (`X-Hub-Signature`) |
| **Push Event Name** | `push` | `push_events` | `repo:push` |
| **PR Event Name** | `pull_request` | `merge_request_events` | `pullrequest:created` |
| **Commit Status API** | `POST /repos/:owner/:repo/statuses/:sha` | `POST /projects/:id/statuses/:sha` | `POST /repositories/:owner/:repo/commit/:sha/statuses/build` |
| **Diff Format** | Unified diff via API | Unified diff via API | Diffstat + spec via API |
| **File Content** | Base64 encoded | Base64 encoded | Raw or Base64 |

### Data Types

| Type | Description |
|---|---|
| `RepoInfo` | Repository metadata (name, fullName, private, defaultBranch, cloneUrl, language) |
| `Branch` | Branch info (name, sha, protected) |
| `CommitInfo` | Commit details (sha, message, author, committer, parents) |
| `WebhookInfo` | Webhook config (id, url, events, active) |
| `PullRequest` | PR details (number, title, state, sourceBranch, targetBranch, author) |
| `CommitStatusInput` | Status update (state: pending/success/failure/error, context, description, targetUrl) |
