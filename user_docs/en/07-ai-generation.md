# AI Generation

## Overview

The AI Service uses LangGraph-based agents and the OpenAI API for automatic code analysis and test generation. The service is available on port **3005**.

## AI Generation Types

### 1. Test Generation

Automatic creation of tests for existing code.

**How it works:**
1. The AI agent analyzes the project source code
2. Identifies functions and classes not covered by tests
3. Generates tests using the project's test framework (Jest, Vitest, etc.)
4. Returns ready-to-use test code

**When to use:**
- When code coverage is low
- For new code written without TDD
- For generating edge-case tests

### 2. Bug Detection

AI-powered code analysis for potential bugs.

**How it works:**
1. The agent scans the project code
2. Searches for patterns that commonly lead to bugs
3. Analyzes edge conditions and error handling
4. Provides descriptions of found issues and fix recommendations

**What it detects:**
- Unhandled exceptions
- Race conditions
- Memory leaks
- Typing issues
- Incorrect null/undefined handling

### 3. Flaky Test Detection

Identification of unstable tests that sometimes pass and sometimes fail.

**How it works:**
1. The agent analyzes run history
2. Finds tests with unstable results
3. Determines the probable cause of instability
4. Suggests fixes

**Common causes of flaky tests:**
- Time dependency
- Race conditions in async code
- Execution order dependency
- Uncleared state between tests

### 4. Coverage Advice

Recommendations for improving code test coverage.

**How it works:**
1. The agent analyzes current coverage
2. Identifies critical uncovered areas
3. Prioritizes by importance
4. Suggests specific tests to write

## Usage

### Via Dashboard

1. Open project → "AI"
2. Click "New Generation"
3. Select generation type
4. Wait for the result
5. Review and decide: "Accept" or "Reject"

### Via API

#### Start Generation

```http
POST /ai/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "projectId": "project-uuid",
  "type": "TEST_GENERATION"
}
```

Available types:
- `TEST_GENERATION` — test generation
- `BUG_DETECTION` — bug detection
- `FLAKY_TEST_DETECTION` — flaky test detection
- `COVERAGE_ADVICE` — coverage recommendations

#### List Generations

```http
GET /ai/generations?projectId=<id>&type=<type>
Authorization: Bearer <token>
```

#### Generation Details

```http
GET /ai/generations/:id
Authorization: Bearer <token>
```

#### Feedback

```http
PATCH /ai/generations/:id/feedback
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "ACCEPTED",
  "feedback": "Tests are correct, applying"
}
```

Statuses: `ACCEPTED`, `REJECTED`

#### Statistics

```http
GET /ai/generations/stats?projectId=<id>
Authorization: Bearer <token>
```

## AI Configuration

Set in `.env`:

```env
# OpenAI API key (required)
OPENAI_API_KEY=sk-your-key

# Models
OPENAI_MODEL_FAST=gpt-4.1-mini      # For fast tasks
OPENAI_MODEL_ADVANCED=o3             # For complex analysis
```

## Agent Architecture

The AI Service uses LangGraph to orchestrate agents:

```
Request → Router → Agent (LangGraph)
                        ↓
               Project code analysis
                        ↓
               Result generation
                        ↓
               Save to database
                        ↓
               Event to Redpanda
```

Each generation type has a specialized agent with a unique set of tools and prompts.

## Best Practices

- **Review results** — AI can generate incorrect tests
- **Use feedback** — this helps improve generation quality
- **Start with TEST_GENERATION** — this is the most mature generation type
- **Combine with manual coverage** — AI supplements, not replaces, manual tests
