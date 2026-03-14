# AI Service

## Overview

| Property | Value |
|---|---|
| **Purpose** | AI-powered test generation, bug detection, flaky test detection, and coverage advice |
| **Port** | 3005 |
| **Database** | `ai_db` (PostgreSQL, port 5440) |
| **Framework** | NestJS |
| **Gateway Route** | `/api/ai/*` |
| **AI Framework** | LangGraph (LangChain) |
| **Models** | gpt-4.1-mini (fast), o3 (advanced) |

## Prisma Schema

```prisma
enum GenerationType {
  TEST_GEN
  BUG_DETECT
  FLAKY_DETECT
  COVERAGE_ADVICE
}

model AIGeneration {
  id           String         @id @default(uuid())
  projectId    String
  type         GenerationType
  inputContext Json
  output       String         @db.Text
  model        String
  tokensUsed   Int            @default(0)
  accepted     Boolean?
  feedback     String?
  createdAt    DateTime       @default(now())
}
```

## API Endpoints

All endpoints require `Bearer JWT` authentication.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/ai/generate` | Bearer JWT | Trigger an AI generation |
| `GET` | `/ai/generations?projectId=<id>&type=<type>` | Bearer JWT | List generations for a project (optionally filtered by type) |
| `GET` | `/ai/generations/stats?projectId=<id>` | Bearer JWT | Get generation statistics for a project |
| `GET` | `/ai/generations/:id` | Bearer JWT | Get generation details |
| `PATCH` | `/ai/generations/:id/feedback` | Bearer JWT | Accept or reject a generation with feedback |

## Generation Types

| Type | Description | Typical Model |
|---|---|---|
| `TEST_GEN` | Generate unit/integration tests for source code | o3 (advanced) |
| `BUG_DETECT` | Analyze test results and code diffs to detect bugs | o3 (advanced) |
| `FLAKY_DETECT` | Identify flaky tests through statistical and pattern analysis | gpt-4.1-mini (fast) |
| `COVERAGE_ADVICE` | Analyze coverage data and recommend improvements | gpt-4.1-mini (fast) |

## LangGraph Agent Architecture

Each generation type is implemented as a LangGraph agent -- a directed graph of processing nodes with conditional edges and an optional refinement loop.

### Test Generator Agent

```mermaid
flowchart TD
    Start([Start]) --> AnalyzeCode
    AnalyzeCode["analyzeCode<br/>Parse source files, detect<br/>framework, identify functions"]
    AnalyzeCode --> GenerateTests
    GenerateTests["generateTests<br/>LLM generates test cases<br/>based on analysis"]
    GenerateTests --> ValidateTests
    ValidateTests["validateTests<br/>Syntax check, import validation,<br/>assertion coverage check"]
    ValidateTests --> QualityGate{"Quality<br/>gate passed?"}
    QualityGate -- No --> RefineTests
    RefineTests["refineTests<br/>LLM fixes validation errors,<br/>adds missing assertions"]
    RefineTests --> ValidateTests
    QualityGate -- Yes --> FormatOutput
    FormatOutput["formatOutput<br/>Structure as code blocks,<br/>add file paths, metadata"]
    FormatOutput --> End([End])

    style Start fill:#22c55e,color:#fff
    style End fill:#22c55e,color:#fff
    style QualityGate fill:#eab308,color:#000
```

**Input context**: Source file contents, existing test files, test framework configuration, language/framework.

**Output**: Generated test file(s) with imports, describe blocks, test cases, assertions, and mocks.

**Model routing**: Uses the advanced model (o3) for complex code analysis and test generation logic.

### Bug Detector Agent

```mermaid
flowchart TD
    Start([Start]) --> AnalyzeResults
    AnalyzeResults["analyzeTestResults<br/>Parse failed tests, group<br/>by failure type"]
    AnalyzeResults --> AnalyzeDiff
    AnalyzeDiff["analyzeCodeDiff<br/>Identify changed files,<br/>modified functions, new code paths"]
    AnalyzeDiff --> CrossReference
    CrossReference["crossReference<br/>Correlate failures with<br/>code changes, identify<br/>root cause candidates"]
    CrossReference --> GenerateReport
    GenerateReport["generateReport<br/>Structured bug report with<br/>severity, location, fix suggestions"]
    GenerateReport --> End([End])

    style Start fill:#22c55e,color:#fff
    style End fill:#22c55e,color:#fff
```

**Input context**: Test run results (failed tests), git diff between commits, file contents around failures.

**Output**: Bug report with severity ratings, affected files/lines, root cause analysis, and suggested fixes.

**Model routing**: Uses the advanced model (o3) for deep reasoning about failure causes.

### Flaky Test Detector Agent

```mermaid
flowchart TD
    Start([Start]) --> StatisticalAnalysis
    StatisticalAnalysis["statisticalAnalysis<br/>Analyze pass/fail ratios<br/>across recent runs,<br/>compute flakiness score"]
    StatisticalAnalysis --> PatternDetection
    PatternDetection["patternDetection<br/>Identify timing-dependent tests,<br/>shared state issues,<br/>environment sensitivity"]
    PatternDetection --> GenerateRecommendations
    GenerateRecommendations["generateRecommendations<br/>Rank tests by flakiness,<br/>suggest stabilization strategies"]
    GenerateRecommendations --> End([End])

    style Start fill:#22c55e,color:#fff
    style End fill:#22c55e,color:#fff
```

**Input context**: Historical test run results (last N runs), test names, durations, pass/fail history.

**Output**: Ranked list of flaky tests with flakiness scores, pattern classifications, and stabilization recommendations.

**Model routing**: Uses the fast model (gpt-4.1-mini) since pattern matching and statistical analysis are less reasoning-intensive.

### Coverage Advisor Agent

```mermaid
flowchart TD
    Start([Start]) --> AnalyzeCoverage
    AnalyzeCoverage["analyzeCoverage<br/>Parse coverage data,<br/>identify uncovered branches,<br/>functions, and lines"]
    AnalyzeCoverage --> GenerateRecommendations
    GenerateRecommendations["generateRecommendations<br/>Prioritize by risk and impact,<br/>suggest specific test cases<br/>for uncovered paths"]
    GenerateRecommendations --> End([End])

    style Start fill:#22c55e,color:#fff
    style End fill:#22c55e,color:#fff
```

**Input context**: Coverage snapshot data (line/branch/function percentages, uncovered file map), source code for uncovered areas.

**Output**: Prioritized list of coverage improvement recommendations with specific test case suggestions.

**Model routing**: Uses the fast model (gpt-4.1-mini) for straightforward coverage analysis.

## Model Routing Strategy

The service uses two OpenAI models with different characteristics:

```mermaid
flowchart LR
    Request["Generation<br/>Request"] --> Router{"Generation<br/>Type?"}
    Router -- "TEST_GEN" --> Advanced["o3<br/>(Advanced Model)"]
    Router -- "BUG_DETECT" --> Advanced
    Router -- "FLAKY_DETECT" --> Fast["gpt-4.1-mini<br/>(Fast Model)"]
    Router -- "COVERAGE_ADVICE" --> Fast

    style Advanced fill:#7c3aed,color:#fff
    style Fast fill:#2563eb,color:#fff
```

| Model | Variable | Use Cases | Characteristics |
|---|---|---|---|
| **gpt-4.1-mini** | `OPENAI_MODEL_FAST` | Flaky detection, coverage advice | Low latency, lower cost, sufficient for pattern matching |
| **o3** | `OPENAI_MODEL_ADVANCED` | Test generation, bug detection | Deep reasoning, higher accuracy for code generation |

## Feedback Loop

Users can accept or reject AI generations with optional textual feedback. This data is stored alongside the generation record and can be used to improve future generations.

```mermaid
sequenceDiagram
    actor User
    participant Dashboard
    participant AIService as AI Service
    participant DB as PostgreSQL

    User->>Dashboard: View AI generation output
    alt User accepts
        User->>Dashboard: Click "Accept" (optional feedback)
        Dashboard->>AIService: PATCH /ai/generations/:id/feedback<br/>{accepted: true, feedback: "Good tests"}
        AIService->>DB: Update accepted=true, feedback
        AIService-->>Dashboard: 200 GenerationResponse
    else User rejects
        User->>Dashboard: Click "Reject" + provide reason
        Dashboard->>AIService: PATCH /ai/generations/:id/feedback<br/>{accepted: false, feedback: "Missing edge cases"}
        AIService->>DB: Update accepted=false, feedback
        AIService-->>Dashboard: 200 GenerationResponse
    end
```
