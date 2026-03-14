# Pipelines & Test Runs

## Pipelines

A pipeline is a configuration for automated test execution. It defines which test types run, in what order, and under what conditions.

### Creating a Pipeline

1. Open project → "Pipelines"
2. Click "New Pipeline"
3. Configure:
   - **Name** — pipeline name
   - **Test types** — select one or more:
     - Unit tests
     - Integration tests
     - E2E tests
     - Load tests
     - Security tests
   - **Triggers** — launch conditions (push, PR, manual)
   - **Parameters** — specific settings for each test type
4. Click "Create"

### Enable / Disable

A pipeline can be temporarily disabled without deletion:

1. Open the pipeline
2. Use the "Active" / "Inactive" toggle

Or via API:
```
POST /pipelines/:id/toggle
```

### Test Types

| Type | Description | Tools |
|------|-------------|-------|
| **Unit** | Unit tests of individual functions | Jest |
| **Integration** | Component interaction tests | Jest, Supertest |
| **E2E** | End-to-end user scenario tests | Playwright, Cypress |
| **Load** | Load testing | k6, Artillery |
| **Security** | Security testing | OWASP ZAP, Snyk |

### Pipeline API

```
POST   /pipelines                    — Create pipeline
GET    /pipelines?projectId=<id>     — List project pipelines
GET    /pipelines/:id                — Pipeline details
PATCH  /pipelines/:id                — Update configuration
DELETE /pipelines/:id                — Delete
POST   /pipelines/:id/toggle         — Enable/disable
```

## Test Runs

A test run is a single execution of a pipeline. It contains results of all tests, coverage metrics, and artifacts.

### Triggering

#### Automatic (via webhook)

On push or pull request to a connected repository, the system automatically:

1. Receives the event from the Git provider
2. Finds active pipelines for the project
3. Creates a test run
4. Passes it to Temporal for execution

#### Manual

1. Open pipeline → "Runs"
2. Click "Run"
3. Optionally specify a branch or commit
4. Confirm launch

Or via API:
```
POST /test-runs
Body: { "pipelineId": "...", "branch": "main", "commit": "abc123" }
```

### Run Lifecycle

```
PENDING → RUNNING → PASSED / FAILED / ERROR
                  ↘ CANCELLED
```

| Status | Description |
|--------|-------------|
| `PENDING` | Run created, waiting for execution |
| `RUNNING` | Tests are executing |
| `PASSED` | All tests passed successfully |
| `FAILED` | One or more tests failed |
| `ERROR` | Execution error occurred |
| `CANCELLED` | Run cancelled by user |

### Cancelling a Run

```
POST /test-runs/:id/cancel
```

### Results

Each run contains:

- **Test results** — status of each test (passed/failed/skipped)
- **Logs** — test framework output
- **Execution time** — duration of each test and total time
- **Code coverage** — coverage percentage (if collection is enabled)
- **Artifacts** — screenshots, reports uploaded to MinIO

### Real-time Updates

Pipeline Service supports SSE (Server-Sent Events) for real-time progress:

- Run status changes
- Individual test completions
- Execution percentage updates

Dashboard and mobile app automatically subscribe to the SSE stream.

### Code Coverage

Coverage snapshots are saved for each run:

- Overall coverage percentage
- Per-file coverage
- Coverage trends over time

### Test Run API

```
POST   /test-runs                    — Create and trigger
GET    /test-runs?pipelineId=<id>    — List runs
GET    /test-runs/:id                — Run details with results
POST   /test-runs/:id/cancel         — Cancel run
```

## Temporal Workflows

Test runs are orchestrated via Temporal:

1. **Pipeline Service** creates a run record and sends an event to Redpanda
2. **Test Runner** (Temporal Worker) receives the event and starts a workflow
3. The workflow executes steps: clone, install dependencies, run tests
4. Results and artifacts are sent back via events
5. **Pipeline Service** updates status and results

You can monitor workflows in **Temporal UI**: http://localhost:8233

## Checklists

Checklists provide a structured way to define, generate, and execute test scenarios against a live application.

### Creating a Checklist

1. Open project → **"Checklists"** in sidebar
2. Click **"New Checklist"**
3. Fill in name, description, and target URL
4. Add test items (title, description, expected behavior, priority)
5. Click **"Create Checklist"**

### AI-Generated Checklists

1. Open the AI page → select **"Checklist Generation"** type
2. Provide app description or target URL
3. AI generates 10-25 test scenarios
4. Import the generated checklist

### Generating Tests from Checklist Items

1. Open a checklist
2. Click **"Generate Test"** on any item → AI creates a Playwright test
3. Or click **"Generate All Tests"** to generate for all items at once
4. Review generated code in the expandable section under each item

### Running a Checklist

1. Enter the **Target URL** (the live app to test against)
2. Click **"Run Checklist"**
3. The system executes each item's Playwright test sequentially
4. Results appear in real-time: RUNNING → PASSED / FAILED
5. Each item shows duration, output log, and screenshots

### Import / Export

**Export**: Open checklist → click "Export" → saves as JSON file

**Import**: Checklists page → "Import" → paste JSON or upload file

JSON format:
```json
{
  "version": "1.0",
  "name": "My Checklist",
  "items": [
    {
      "title": "Login with valid credentials",
      "description": "...",
      "expectedBehavior": "User sees dashboard",
      "priority": "CRITICAL",
      "generatedTestCode": "..."
    }
  ]
}
```

### Checklist API

```
GET    /checklists?projectId=<id>            — List checklists
POST   /checklists                            — Create checklist
GET    /checklists/:id                        — Get with items
PATCH  /checklists/:id                        — Update
DELETE /checklists/:id                        — Delete
POST   /checklists/:id/items                  — Add item
POST   /checklists/:id/run                    — Trigger execution
POST   /checklists/:id/export                 — Export JSON
POST   /checklists/import                     — Import JSON
GET    /checklist-runs/:runId                  — Get run results
```
