# AI Test Generation Wizard — Technical Reference

## Overview

The AI Test Generation Wizard is a multi-step orchestration feature that analyzes a Git repository, proposes test files via LLM, generates test code, validates it locally (tsc + eslint), and commits results back to the repository. It spans the AI service (NestJS), the Organization service (provider tokens), the Project service (repo metadata), and the Next.js dashboard (wizard UI).

## Architecture

```
 Dashboard (Next.js 15)               AI Service (NestJS :3005)
 ========================             ===============================
 test-wizard/ page                    TestGenSessionController
   |                                    |
   | REST + JWT Bearer                  v
   +------------------------------> TestGenSessionService (orchestrator)
                                        |
                        +---------------+----------------+------------------+
                        |               |                |                  |
                  ProjectAnalyzer  TestProposer     TestGenerator     LocalValidator
                  Service          Service          Service (LangGraph) Service
                        |               |                |                  |
                        v               v                v                  v
                   ProjectAnalyzer  TestProposer    TestGenerator     shell: git clone
                   Agent            Agent           Agent               tsc, eslint
                   (gpt-4.1-mini)   (o3)            (o3 + gpt-4.1-mini)
                        |               |                |
                        +-------+-------+----------------+
                                |
                                v
                          GitAdapterFactory
                           |       |        |
                        GitHub   GitLab  Bitbucket
                        Adapter  Adapter  Adapter
                                |
                                v
                     Organization Service (:3002)
                     /api/v1/provider-tokens
                                |
                                v
                       Project Service (:3003)
                       /api/v1/projects/:id
```

## Module Structure

```
services/ai/src/
  test-gen-session/
    test-gen-session.module.ts          # NestJS module (imports AgentsModule, GitAdapterModule)
    test-gen-session.controller.ts      # REST endpoints under /ai/test-gen-sessions
    test-gen-session.service.ts         # Orchestrator: session lifecycle, step coordination
    test-gen-session.repository.ts      # Prisma CRUD for TestGenSession
    project-profile.repository.ts       # Prisma CRUD for ProjectProfile
    local-validator.service.ts          # Clone repo, run tsc + eslint, report errors
    test-cleanup.util.ts                # Post-processing: remove unused imports/vars, fix types
    validation-error-parser.util.ts     # Parse tsc/eslint output into structured errors
    dto/
      start-session.dto.ts             # Request DTOs (StartSession, Approve, Commit, etc.)
  git-adapter/
    git-adapter.interface.ts            # GitAdapter interface + data types
    git-adapter.factory.ts              # Factory: creates adapter per provider using org token
    github.adapter.ts                   # GitHub REST API v3 implementation
    gitlab.adapter.ts                   # GitLab API implementation
    bitbucket.adapter.ts                # Bitbucket API implementation
    git-adapter.module.ts               # NestJS module exporting GitAdapterFactory
  agents/
    base-agent.ts                       # Abstract base: configures ChatOpenAI (model + fastModel)
    types.ts                            # All agent I/O interfaces
    project-analyzer/
      project-analyzer.agent.ts         # LLM call: file tree + configs -> ProjectProfile JSON
      project-analyzer.service.ts       # NestJS wrapper
    test-proposer/
      test-proposer.agent.ts            # LLM call: source files + profile -> TestProposal JSON
      test-proposer.service.ts          # NestJS wrapper
    test-generator/
      test-generator.agent.ts           # LangGraph: analyze -> generate -> validate -> refine -> format
      test-generator.service.ts         # NestJS wrapper (run + runFast)
```

## Database Schema

All tables live in `ai_db` (PostgreSQL on port 5440).

### TestGenSession

| Column            | Type                  | Description                                        |
|-------------------|-----------------------|----------------------------------------------------|
| id                | UUID (PK)             | Session identifier                                 |
| project_id        | String                | FK to project (in project service)                 |
| status            | TestGenSessionStatus  | Current state (see state machine below)            |
| profile_id        | UUID (nullable)       | FK to ProjectProfile                               |
| proposal          | JSON (nullable)       | TestProposal object from proposer agent            |
| approved_items    | JSON (nullable)       | Subset of proposal items approved by user          |
| generated_tests   | JSON (nullable)       | Array of `{ path, content }` generated test files  |
| branch_name       | String (nullable)     | Git branch created for commit                      |
| commit_sha        | String (nullable)     | Commit SHA after push                              |
| commit_url        | String (nullable)     | URL to view the commit                             |
| pull_request_url  | String (nullable)     | PR URL if user opted to create one                 |
| total_tokens_used | Int (default 0)       | Running total of LLM tokens consumed               |
| metadata          | JSON (nullable)       | Progress info: `{ phase, currentTest, totalTests }` |
| error             | String (nullable)     | Error message on failure                           |
| created_at        | DateTime              | Session creation timestamp                         |
| updated_at        | DateTime              | Last update timestamp                              |

Indexes: `project_id`, `status`.

### ProjectProfile

| Column          | Type                | Description                                  |
|-----------------|---------------------|----------------------------------------------|
| id              | UUID (PK)           | Profile identifier                           |
| project_id      | String (unique)     | One profile per project                      |
| language        | String              | Primary language (typescript, python, etc.)   |
| test_framework  | String              | Detected framework (jest, vitest, pytest...)  |
| package_manager | String (nullable)   | npm, pnpm, yarn, pip, maven, etc.            |
| structure       | JSON                | `{ sourceDirectories, testDirectories, configFiles, totalFiles }` |
| test_patterns   | JSON (nullable)     | `{ filePattern, existingTests, estimatedCoverage }` |
| dependencies    | JSON (nullable)     | `{ runtime, devDependencies, testRelated }`  |
| analyzed_at     | DateTime            | When the analysis last ran                   |
| created_at      | DateTime            | Profile creation timestamp                   |
| updated_at      | DateTime            | Last update timestamp                        |

Index: `project_id`.

## Session State Machine

```
  START
    |
    v
 ANALYZING ──────────────────────────> FAILED
    |                                    ^
    v                                    |
 PROPOSING ──────────────────────────> FAILED
    |                                    ^
    v                                    |
 AWAITING_APPROVAL                       |
    |                                    |
    v                                    |
 GENERATING ─────────────────────────> FAILED
    |                                    ^
    v                                    |
 VALIDATING ─────────────────────────> FAILED
    |         |                          ^
    |  (skip) |                          |
    v         v                          |
 REVIEW <-----+                          |
    |                                    |
    +----> COMMITTING ────────────────> FAILED
              |
              v
           COMMITTED

 Any non-terminal state ──> CANCELLED
```

**Status descriptions:**

| Status              | Meaning                                                         |
|---------------------|-----------------------------------------------------------------|
| `ANALYZING`         | Scanning file tree and config files, running ProjectAnalyzer agent |
| `PROPOSING`         | TestProposer agent analyzing source files                       |
| `AWAITING_APPROVAL` | Proposal ready; waiting for user to select items                |
| `GENERATING`        | TestGenerator agent producing test code per approved item       |
| `VALIDATING`        | Local validator: clone, install deps, tsc, eslint               |
| `REVIEW`            | Tests ready for user review and editing                         |
| `COMMITTING`        | Creating branch and committing files via Git provider API       |
| `COMMITTED`         | Branch created, commit pushed, optional PR created              |
| `CANCELLED`         | User cancelled the session                                      |
| `FAILED`            | Unrecoverable error at any stage                                |

## API Reference

All endpoints are under `@UseGuards(JwtAuthGuard)` and require a Bearer JWT token.

Base path: `/ai/test-gen-sessions`

### POST / — Start Session

Creates a new session and kicks off project analysis in the background.

**Request body:**
```json
{
  "projectId": "uuid",
  "locale": "en"           // optional, for localized output
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "status": "ANALYZING",
  "createdAt": "2026-03-18T...",
  "updatedAt": "2026-03-18T..."
}
```

Analysis runs asynchronously. Poll `GET /:id` until status changes to `PROPOSING`.

### GET / — List Sessions

**Query params:** `projectId` (required)

**Response:** `200 OK` — Array of up to 20 sessions, newest first.

### GET /:id — Get Session

**Response:** `200 OK` — Full session object including `proposal`, `generatedTests`, `metadata`, etc.

### GET /profile/:projectId — Get Project Profile

Returns the cached `ProjectProfile` for a project (created during analysis).

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "projectId": "uuid",
  "language": "typescript",
  "testFramework": "jest",
  "packageManager": "pnpm",
  "structure": { "sourceDirectories": ["src"], "testDirectories": ["src/__tests__"], ... },
  "testPatterns": { "filePattern": "*.spec.ts", "existingTests": [...], ... },
  "dependencies": { "runtime": [...], "devDependencies": [...], "testRelated": [...] }
}
```

### POST /:id/propose — Generate Proposal

Triggers the TestProposer agent. Session must be in `PROPOSING` status (post-analysis).

**Request body:**
```json
{
  "focusArea": "authentication module",   // optional
  "locale": "en"                          // optional
}
```

**Response:** `200 OK` — `TestProposal` object:
```json
{
  "items": [
    {
      "id": "test-1",
      "targetFile": "src/auth/auth.service.ts",
      "testFilePath": "src/auth/__tests__/auth.service.spec.ts",
      "testType": "unit",
      "description": "Test authentication flow including token validation...",
      "rationale": "Critical business logic with no existing tests",
      "priority": "high",
      "estimatedTests": 8
    }
  ],
  "summary": "Proposed 5 test files covering...",
  "estimatedTokens": 12000
}
```

Session moves to `AWAITING_APPROVAL`.

### POST /:id/approve — Approve Proposal Items

User selects which proposed items to generate.

**Request body:**
```json
{
  "approvedItemIds": ["test-1", "test-3", "test-5"]
}
```

**Response:** `200 OK`
```json
{
  "approvedCount": 3
}
```

Session moves to `GENERATING`.

### POST /:id/generate — Start Test Generation

Triggers background generation for all approved items. Returns immediately.

**Response:** `200 OK`
```json
{
  "status": "GENERATING",
  "sessionId": "uuid"
}
```

Poll `GET /:id` to track progress via `metadata.currentTest`, `metadata.totalTests`, `metadata.phase`.

### POST /:id/regenerate — Regenerate Specific Tests

Re-generates specific items from a session in `REVIEW`, `COMMITTED`, or `AWAITING_APPROVAL` status.

**Request body:**
```json
{
  "itemIds": ["test-2"]
}
```

**Response:** `200 OK`
```json
{
  "status": "GENERATING",
  "sessionId": "uuid",
  "itemCount": 1
}
```

Existing tests for other items are preserved. Only the specified items are regenerated and merged.

### PATCH /:id/tests — Update Tests

User edits test content during `REVIEW` status.

**Request body:**
```json
{
  "tests": [
    { "path": "src/__tests__/auth.service.spec.ts", "content": "import ..." }
  ]
}
```

**Response:** `200 OK` — Updated tests array.

### POST /:id/skip-validation — Skip Validation

Available during `VALIDATING` or `GENERATING` status. Moves session directly to `REVIEW`.

**Response:** `200 OK`
```json
{
  "status": "REVIEW",
  "sessionId": "uuid"
}
```

### POST /:id/cancel — Cancel Session

Cancels from any non-terminal status.

**Response:** `200 OK`
```json
{
  "status": "CANCELLED",
  "sessionId": "uuid"
}
```

### POST /:id/commit — Commit Tests

Creates a branch, commits test files, optionally creates a pull request. Session must be in `REVIEW`.

**Request body:**
```json
{
  "createPR": true,                                       // optional, default false
  "commitMessage": "test: add unit tests for auth module" // optional, auto-generated if omitted
}
```

**Response:** `200 OK`
```json
{
  "branchName": "ai/test-gen-1710763200000",
  "commitSha": "abc123...",
  "commitUrl": "https://github.com/org/repo/commit/abc123",
  "pullRequestUrl": "https://github.com/org/repo/pull/42"
}
```

## Provider Token Endpoints (Organization Service)

These endpoints live on the Organization service (port 3002) and are used to store Git provider credentials.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST   | `/organizations/:orgId/provider-tokens` | JWT | Save a provider token (`{ provider: "GITHUB", token: "ghp_..." }`) |
| GET    | `/organizations/:orgId/provider-tokens` | JWT | List configured providers (tokens masked) |
| DELETE | `/organizations/:orgId/provider-tokens/:provider` | JWT | Remove a provider token |
| GET    | `/api/v1/provider-tokens?orgId=&provider=` | Internal (no auth) | Inter-service token retrieval, returns `{ token }` |

## Git Adapter Interface

All three provider adapters (GitHub, GitLab, Bitbucket) implement:

```typescript
interface GitAdapter {
  getFileTree(owner, repo, branch, pathPrefix?): Promise<FileTreeEntry[]>;
  getFileContent(owner, repo, branch, filePath): Promise<FileContent>;
  getMultipleFiles(owner, repo, branch, filePaths): Promise<FileContent[]>;
  getDiff(owner, repo, base, head): Promise<DiffEntry[]>;
  createBranch(owner, repo, branchName, fromRef): Promise<void>;
  commitFiles(owner, repo, branch, files, message): Promise<CommitResult>;
  createPullRequest(owner, repo, title, body, head, base): Promise<PullRequestResult>;
}
```

**Data types:**

```typescript
interface FileTreeEntry { path: string; type: 'file' | 'dir'; size?: number; }
interface FileContent   { path: string; content: string; encoding: string; size: number; }
interface CommitFile     { path: string; content: string; }
interface CommitResult   { sha: string; url: string; message: string; }
interface PullRequestResult { number: number; url: string; title: string; }
interface DiffEntry      { filename: string; status: 'added'|'modified'|'removed'|'renamed'; additions: number; deletions: number; patch?: string; }
```

**Factory behavior:**

`GitAdapterFactory.createForOrg(provider, orgId)` fetches the encrypted token from the Organization service via internal endpoint, then instantiates the appropriate adapter. If no token is configured, throws `BadRequestException` with a user-friendly message directing the admin to Organization Settings.

**GitHub adapter specifics:**
- Uses GitHub REST API v3 with `Bearer` auth and `X-GitHub-Api-Version: 2022-11-28`
- `getFileTree` uses `git/trees?recursive=1`; filters out `node_modules/`, `.git/`, `dist/`, `build/`, etc.
- `getMultipleFiles` fetches in parallel batches of 5 with `Promise.allSettled`
- `commitFiles` uses the low-level Git Data API (create blobs, create tree, create commit, update ref)
- Handles truncated trees for large repos with a warning log

## Local Validation Flow

After test generation, the service runs local validation to catch TypeScript and ESLint errors before the user reviews.

```
1. Clone repo (shallow, --depth=1) into temp directory
   - Auth URL built per provider: GITHUB uses x-access-token, GITLAB uses oauth2, BITBUCKET uses x-token-auth
2. Install dependencies (frozen lockfile, --ignore-scripts)
   - Detects package manager from lockfile (pnpm-lock.yaml / yarn.lock / package-lock.json)
   - Falls back to non-lockfile install if frozen install fails
   - Handles monorepo: finds nearest package.json for each test file, installs deps per package
3. Copy generated test files into the cloned repo
4. Run `npx tsc --noEmit` per package directory
   - Parses output: "file(line,col): error TS####: message"
   - Filters to only errors in generated test files
5. Run `npx eslint --format json` per package directory
   - Only runs if ESLint config exists
   - Parses JSON output, filters severity >= 2 (errors only)
6. If errors found and attempts < 3:
   - Group errors by file
   - Format errors into LLM prompt with line context
   - Call TestGenerator.generateFast() to produce fixed code
   - Clean up fixed code (strip markdown fences, run cleanup pipeline)
   - Repeat from step 4
7. After 3 attempts or if valid: proceed to REVIEW
```

The temp directory is always cleaned up in a `finally` block.

## Test Code Post-Processing Pipeline

`cleanGeneratedTest()` runs these passes in order:

1. **`fixCommonTypeIssues`** — Replace `NodeJS.ProcessEnv` with `Record<string, string | undefined>`; remove `@ts-expect-error` and `@ts-ignore` directives; add `/// <reference types="node" />` if `NodeJS` is referenced.
2. **`cleanUnusedImports`** — Parse all `import` statements (including multi-line), check each imported name against the code body, remove entirely unused imports, rebuild partially-unused imports with only the referenced names.
3. **`cleanUnusedVariables`** — Find `const`/`let` declarations where the variable name appears nowhere else in the file; remove them (skips common test globals like `module`, `app`, `describe`, etc.).
4. **Collapse blank lines** — Replace 3+ consecutive newlines with 2.

Additionally, `fixImportPaths()` runs after generation to correct relative import paths using a precomputed map of `sourceFile -> correctRelativeImport`.

## LLM Models Used

| Agent             | Model                                      | Purpose                        |
|-------------------|--------------------------------------------|--------------------------------|
| ProjectAnalyzer   | `OPENAI_MODEL_FAST` (gpt-4.1-mini)         | Analyze repo structure         |
| TestProposer      | `OPENAI_MODEL_ADVANCED` (o3)               | Propose tests with rationale   |
| TestGenerator     | `OPENAI_MODEL_ADVANCED` (o3)               | Generate test code             |
| TestGenerator (validate) | `OPENAI_MODEL_FAST` (gpt-4.1-mini)  | Validate generated tests       |
| Validation fix    | `OPENAI_MODEL_FAST` via generateFast()     | Fix tsc/eslint errors          |
| LLM review pass   | `OPENAI_MODEL_FAST` via generateFast()     | Post-generation import/type fix|

The `BaseAgent` class configures both models. For `o3`-series reasoning models, temperature is not set (not supported). For `gpt-4.1-mini`, temperature is 0.1.

**LangGraph state machine for TestGeneratorAgent:**

```
Full mode:   START -> analyzeCode -> generateTests -> validateTests -+-> formatOutput -> END
                                                       ^             |
                                                       |   (refine)  |
                                                       +-- refineTests <-+
                                                       (max 1 refinement)

Fast mode:   START -> analyzeCode -> generateTests -> formatOutput -> END
```

The wizard uses **fast mode** (`generateFast`) for batch generation, then runs a separate LLM validation pass and local validation. Full mode (with built-in validate/refine loop) is used for single test generation via other features.

## Error Handling

- **Agent failures**: Caught in service, session marked as `FAILED` with error message stored in `error` column.
- **Async generation**: `generateApprovedTests` and `analyzeProject` run in background (fire-and-forget with `.catch`). Errors are logged and session is updated to `FAILED`.
- **Cancellation check**: During generation loop, each iteration checks if status has been changed to `CANCELLED` before proceeding.
- **Validation fallback**: If local validation infrastructure fails entirely (e.g., git clone fails), the service logs a warning and proceeds to `REVIEW` with `metadata.phase = 'validation_skipped'`.
- **Git adapter errors**: `GitAdapterFactory` throws `BadRequestException` with actionable messages (e.g., "No GITHUB token configured for this organization. Ask an admin to add it in Organization Settings -> Integrations.").

## Configuration (Environment Variables)

| Variable                  | Default                                         | Description                              |
|---------------------------|-------------------------------------------------|------------------------------------------|
| `PORT`                    | `3005`                                          | AI service HTTP port                     |
| `DATABASE_URL`            | `postgresql://postgres:postgres@localhost:5440/ai_db` | AI database connection string      |
| `JWT_SECRET`              | (required)                                      | Must match all other services            |
| `OPENAI_API_KEY`          | (required)                                      | OpenAI API key                           |
| `OPENAI_MODEL_FAST`       | `gpt-4.1-mini`                                  | Fast model for analysis/validation       |
| `OPENAI_MODEL_ADVANCED`   | `o3`                                            | Advanced model for generation            |
| `PROJECT_SERVICE_URL`     | `http://localhost:3003`                         | Internal URL for project service         |
| `ORGANIZATION_SERVICE_URL`| `http://localhost:3002`                         | Internal URL for organization service    |
| `GITLAB_URL`              | `https://gitlab.com`                            | Base URL for self-hosted GitLab          |
| `KAFKA_BROKERS`           | `localhost:9092`                                | Kafka/Redpanda broker address            |
| `DASHBOARD_URL`           | `http://localhost:4200`                         | Dashboard URL (for links in PRs, etc.)   |

## Security Considerations

1. **Provider tokens**: Stored in the Organization service database. Retrieved via internal endpoint (`/api/v1/provider-tokens`) with no JWT auth — this endpoint must not be exposed externally. The AI service never persists tokens; it fetches them on demand per operation.

2. **Token scoping**: GitHub tokens need `repo` scope (read file tree, read contents, create branch, push commits, create PR). GitLab tokens need `api` scope. Bitbucket tokens need repository read/write.

3. **JWT authentication**: All wizard endpoints use `JwtAuthGuard`. The dashboard passes the session JWT from NextAuth.

4. **Local validation isolation**: Repos are cloned into OS temp directories with `--depth=1`. Dependencies are installed with `--ignore-scripts` to prevent arbitrary code execution. Temp directories are cleaned up in `finally` blocks.

5. **Token in clone URLs**: Auth tokens are embedded in the clone URL (e.g., `https://x-access-token:TOKEN@github.com/...`). These URLs exist only in memory during the validation phase and are not persisted.

6. **Source code exposure**: The AI service sends source file contents to OpenAI's API for analysis and generation. This should be documented in the platform's privacy policy. Organizations handling sensitive code should evaluate this data flow.

7. **Rate limiting**: No built-in rate limiting on the wizard endpoints. File fetching has a batch concurrency of 5, and source files are capped at 30 per proposal. Import resolution is capped at 20 files.
