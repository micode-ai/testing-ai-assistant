# Event-Driven Architecture

## Overview

The platform uses Redpanda (a Kafka-compatible streaming platform) as the central event bus for asynchronous inter-service communication. This decouples producers from consumers, enables fan-out, and provides event replay capabilities.

## Redpanda Configuration

| Property | Value |
|---|---|
| **Broker Address (internal)** | `redpanda:29092` |
| **Broker Address (external)** | `localhost:19092` |
| **Schema Registry** | `localhost:18081` |
| **Console UI** | `http://localhost:18080` |

## Topic Registry

| Topic | Description |
|---|---|
| `pipeline.trigger` | A pipeline should be triggered (from webhook or schedule) |
| `run.started` | A test run has begun execution |
| `run.step.completed` | A single step within a test run has completed |
| `run.finished` | A test run has fully completed |
| `membership.requested` | A user was invited to an organization |
| `membership.approved` | A membership request was approved |
| `membership.rejected` | A membership request was rejected |
| `generation.completed` | An AI generation has completed |
| `coverage.updated` | Coverage data has been updated for a project |

## Event Flow: Full Pipeline Execution

This diagram shows the complete data flow from a git webhook event to user notification.

```mermaid
flowchart TD
    subgraph External
        Git["GitHub / GitLab / Bitbucket"]
    end

    subgraph ProjectService["Project Service"]
        WebhookHandler["Webhook Handler<br/>Verify signature, parse event"]
    end

    subgraph Redpanda["Redpanda Event Bus"]
        T1["pipeline.trigger"]
        T2["run.started"]
        T3["run.step.completed"]
        T4["run.finished"]
        T5["generation.completed"]
    end

    subgraph PipelineService["Pipeline Service"]
        TriggerConsumer["Consume pipeline.trigger<br/>Find pipeline, create TestRun"]
        RunManager["Run Manager<br/>Update status, save results"]
    end

    subgraph Temporal
        Workflow["testPipelineWorkflow"]
    end

    subgraph AIService["AI Service"]
        AIConsumer["Consume run.finished<br/>Trigger bug/flaky detection"]
    end

    subgraph NotificationService["Notification Service"]
        NotifyConsumer["Consume events<br/>Dispatch to channels"]
    end

    subgraph Channels
        Email["Email"]
        Slack["Slack"]
        Telegram["Telegram"]
        Push["Push"]
    end

    Git -- "webhook POST" --> WebhookHandler
    WebhookHandler -- "produce" --> T1

    T1 -- "consume" --> TriggerConsumer
    TriggerConsumer -- "produce" --> T2
    TriggerConsumer -- "start workflow" --> Workflow

    Workflow -- "report step" --> RunManager
    RunManager -- "produce" --> T3

    Workflow -- "workflow complete" --> RunManager
    RunManager -- "produce" --> T4

    T4 -- "consume" --> AIConsumer
    AIConsumer -- "produce" --> T5

    T2 -- "consume" --> NotifyConsumer
    T3 -- "consume" --> NotifyConsumer
    T4 -- "consume" --> NotifyConsumer
    T5 -- "consume" --> NotifyConsumer

    NotifyConsumer --> Email
    NotifyConsumer --> Slack
    NotifyConsumer --> Telegram
    NotifyConsumer --> Push
```

## Event Types Reference

### pipeline.trigger

| Field | Type | Description |
|---|---|---|
| `projectId` | string | Project that received the webhook |
| `commitSha` | string | Commit SHA that triggered the pipeline |
| `branch` | string | Branch name |
| `trigger` | enum | `PUSH`, `PULL_REQUEST`, `SCHEDULE`, `MANUAL` |
| `repoUrl` | string | Repository clone URL |
| `metadata` | object | Additional context (PR number, author, etc.) |

**Producer**: Project Service
**Consumers**: Pipeline Service

### run.started

| Field | Type | Description |
|---|---|---|
| `runId` | string | Test run ID |
| `pipelineId` | string | Pipeline ID |
| `projectId` | string | Project ID |
| `commitSha` | string | Commit SHA |
| `branch` | string | Branch name |
| `triggeredBy` | string | User ID or "webhook" |

**Producer**: Pipeline Service
**Consumers**: Notification Service

### run.step.completed

| Field | Type | Description |
|---|---|---|
| `runId` | string | Test run ID |
| `checkType` | string | Step type (unit, lint, sast, etc.) |
| `status` | string | Step status (passed, failed, errored) |
| `summary` | string | Human-readable summary |
| `durationMs` | number | Step duration in milliseconds |
| `artifactUrl` | string | URL to artifact in MinIO (if any) |

**Producer**: Pipeline Service (via Temporal reporting)
**Consumers**: Notification Service (optional, for step-level alerts)

### run.finished

| Field | Type | Description |
|---|---|---|
| `runId` | string | Test run ID |
| `pipelineId` | string | Pipeline ID |
| `projectId` | string | Project ID |
| `status` | string | Final status (PASSED, FAILED, ERRORED) |
| `commitSha` | string | Commit SHA |
| `branch` | string | Branch name |
| `durationMs` | number | Total run duration |
| `coverage` | object | Coverage metrics (if collected) |

**Producer**: Pipeline Service
**Consumers**: AI Service, Notification Service

### membership.requested

| Field | Type | Description |
|---|---|---|
| `orgId` | string | Organization ID |
| `userId` | string | Invited user ID |
| `invitedBy` | string | Admin user ID who invited |
| `role` | string | Requested role |

**Producer**: Organization Service
**Consumers**: Notification Service

### membership.approved / membership.rejected

| Field | Type | Description |
|---|---|---|
| `orgId` | string | Organization ID |
| `userId` | string | User ID |
| `resolvedBy` | string | Admin user ID who resolved |
| `status` | string | `APPROVED` or `REJECTED` |

**Producer**: Organization Service
**Consumers**: Notification Service

### generation.completed

| Field | Type | Description |
|---|---|---|
| `generationId` | string | AI generation ID |
| `projectId` | string | Project ID |
| `type` | string | Generation type |
| `model` | string | Model used |
| `tokensUsed` | number | Total tokens consumed |

**Producer**: AI Service
**Consumers**: Notification Service

## Producer/Consumer Matrix

```mermaid
flowchart LR
    subgraph Producers
        P_Project["Project<br/>Service"]
        P_Pipeline["Pipeline<br/>Service"]
        P_Org["Organization<br/>Service"]
        P_AI["AI<br/>Service"]
    end

    subgraph Topics
        T1["pipeline.trigger"]
        T2["run.started"]
        T3["run.step.completed"]
        T4["run.finished"]
        T5["membership.requested"]
        T6["membership.approved"]
        T7["membership.rejected"]
        T8["generation.completed"]
    end

    subgraph Consumers
        C_Pipeline["Pipeline<br/>Service"]
        C_AI["AI<br/>Service"]
        C_Notify["Notification<br/>Service"]
    end

    P_Project --> T1
    P_Pipeline --> T2
    P_Pipeline --> T3
    P_Pipeline --> T4
    P_Org --> T5
    P_Org --> T6
    P_Org --> T7
    P_AI --> T8

    T1 --> C_Pipeline
    T2 --> C_Notify
    T3 --> C_Notify
    T4 --> C_AI
    T4 --> C_Notify
    T5 --> C_Notify
    T6 --> C_Notify
    T7 --> C_Notify
    T8 --> C_Notify
```

## EventEmitter2 Internal Events

In addition to Redpanda events for inter-service communication, each NestJS service uses `EventEmitter2` for intra-service event handling. These events do not cross service boundaries.

| Service | Internal Event | Description |
|---|---|---|
| Pipeline | `testrun.status.changed` | TestRun status updated; triggers SSE push to connected clients |
| Pipeline | `testresult.saved` | TestResult saved to DB; triggers SSE step update |
| Identity | `user.created` | New user registered; triggers Keycloak sync |
| Identity | `user.oauth.linked` | OAuth account linked to user |
| Organization | `membership.status.changed` | Membership status updated; triggers Redpanda event |
| AI | `generation.started` | AI generation began processing |
| AI | `generation.finished` | AI generation completed; triggers Redpanda event |
| Notification | `notification.dispatched` | Notification sent to channel; updates log |

## Consumer Groups

Each consuming service uses a dedicated consumer group to ensure:

- **Independent consumption**: Each service processes events at its own pace
- **At-least-once delivery**: Failed processing triggers redelivery within the consumer group
- **Parallel processing**: Multiple instances of a service can share the load within a consumer group

| Consumer Group | Service | Topics Consumed |
|---|---|---|
| `pipeline-service` | Pipeline Service | `pipeline.trigger` |
| `ai-service` | AI Service | `run.finished` |
| `notification-service` | Notification Service | `run.started`, `run.step.completed`, `run.finished`, `membership.*`, `generation.completed` |
