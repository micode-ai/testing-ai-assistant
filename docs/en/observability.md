# Observability

## Overview

The platform uses the OpenTelemetry (OTel) standard for collecting traces, logs, and metrics from all microservices. Data flows through the OTel Collector and is stored in the Grafana stack (Tempo, Loki, Prometheus) for visualization.

```mermaid
graph LR
    subgraph Services
        Identity["Identity"]
        Org["Organization"]
        Project["Project"]
        Pipeline["Pipeline"]
        AI["AI"]
        Notify["Notification"]
        Runner["Test Runner"]
    end

    subgraph Collection
        OTel["OTel Collector<br/>:4317 (gRPC)<br/>:4318 (HTTP)"]
    end

    subgraph Storage
        Loki["Loki<br/>(Logs)"]
        Tempo["Tempo<br/>(Traces)"]
        Prometheus["Prometheus<br/>(Metrics)"]
    end

    subgraph Visualization
        Grafana["Grafana<br/>:3300"]
    end

    Identity --> OTel
    Org --> OTel
    Project --> OTel
    Pipeline --> OTel
    AI --> OTel
    Notify --> OTel
    Runner --> OTel

    OTel --> Loki
    OTel --> Tempo
    OTel --> Prometheus

    Grafana --> Loki
    Grafana --> Tempo
    Grafana --> Prometheus
```

## OpenTelemetry Setup

Each NestJS service includes the OTel SDK instrumentation that automatically captures:

- **Traces**: HTTP request spans, database query spans, Kafka produce/consume spans
- **Logs**: Structured JSON logs with trace context (traceId, spanId)
- **Metrics**: Request latency histograms, error counters, active connection gauges

### Configuration

| Variable | Default | Description |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTel Collector OTLP endpoint |
| `OTEL_SERVICE_NAME` | `testing-ai` | Base service name for telemetry |

Each service appends its own name to the base, resulting in service names like `testing-ai-identity`, `testing-ai-pipeline`, etc.

### OTel Collector Configuration

The collector receives telemetry data and routes it to the appropriate backends:

```
infrastructure/observability/otel-collector/otel-collector-config.yml
```

```mermaid
flowchart LR
    subgraph Receivers
        OTLP_gRPC["OTLP gRPC<br/>:4317"]
        OTLP_HTTP["OTLP HTTP<br/>:4318"]
    end

    subgraph Processors
        Batch["Batch Processor<br/>Buffer and batch<br/>telemetry data"]
        Resource["Resource Processor<br/>Add environment labels"]
    end

    subgraph Exporters
        LokiExp["Loki Exporter<br/>:3100"]
        TempoExp["Tempo Exporter<br/>:3200"]
        PromExp["Prometheus Exporter<br/>:8889"]
    end

    OTLP_gRPC --> Batch
    OTLP_HTTP --> Batch
    Batch --> Resource
    Resource --> LokiExp
    Resource --> TempoExp
    Resource --> PromExp
```

## Tracing

### Request Tracing Flow

```mermaid
sequenceDiagram
    participant Client
    participant Traefik
    participant Service as Microservice
    participant DB as PostgreSQL
    participant Kafka as Redpanda
    participant OTel as OTel Collector
    participant Tempo
    participant Grafana

    Client->>Traefik: HTTP Request
    Note over Traefik: Generate traceId<br/>W3C Trace Context
    Traefik->>Service: Forward with traceparent header

    activate Service
    Note over Service: Create root span<br/>http.request

    Service->>DB: Query
    Note over Service: Create child span<br/>db.query

    DB-->>Service: Result
    Note over Service: Close db.query span

    Service->>Kafka: Produce event
    Note over Service: Create child span<br/>kafka.produce

    Service-->>Client: HTTP Response
    deactivate Service
    Note over Service: Close http.request span

    Service->>OTel: Export spans (batch)
    OTel->>Tempo: Store trace

    Note over Grafana: User opens trace view
    Grafana->>Tempo: Query trace by traceId
    Tempo-->>Grafana: Return trace spans
```

### Trace Propagation Across Services

When one service calls another (via HTTP or Kafka), the trace context is propagated:

```mermaid
flowchart LR
    subgraph ServiceA["Project Service"]
        SpanA["Span: handle webhook"]
    end

    subgraph Redpanda
        Event["pipeline.trigger<br/>(includes traceparent)"]
    end

    subgraph ServiceB["Pipeline Service"]
        SpanB["Span: consume event"]
        SpanC["Span: create test run"]
    end

    subgraph Temporal
        SpanD["Span: workflow execution"]
    end

    SpanA -- produce --> Event
    Event -- consume --> SpanB
    SpanB --> SpanC
    SpanC -- start workflow --> SpanD
```

All spans share the same `traceId`, providing a complete distributed trace across services.

## Logging (Loki)

### Log Format

All services emit structured JSON logs:

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "level": "info",
  "service": "testing-ai-pipeline",
  "traceId": "abc123def456",
  "spanId": "789ghi",
  "message": "Test run created",
  "context": {
    "runId": "run-uuid",
    "pipelineId": "pipeline-uuid",
    "status": "QUEUED"
  }
}
```

### Log Levels

| Level | Usage |
|---|---|
| `error` | Unrecoverable errors, exceptions |
| `warn` | Recoverable issues, degraded performance |
| `info` | Business events (run started, generation completed) |
| `debug` | Detailed diagnostic information |
| `verbose` | Trace-level detail (database queries, HTTP calls) |

### Querying Logs in Grafana

Use LogQL queries in Grafana:

```
# All errors from pipeline service
{service="testing-ai-pipeline"} |= "error"

# Logs for a specific test run
{service="testing-ai-pipeline"} | json | runId="<run-id>"

# All logs for a trace
{traceId="<trace-id>"}
```

## Tracing (Tempo)

| Property | Value |
|---|---|
| **Port** | 3200 |
| **Protocol** | OTLP gRPC via OTel Collector |
| **Retention** | Configurable (default: 72 hours in dev) |

### Key Trace Attributes

| Attribute | Description |
|---|---|
| `service.name` | Service that generated the span |
| `http.method` | HTTP method (GET, POST, etc.) |
| `http.url` | Full request URL |
| `http.status_code` | Response status code |
| `db.system` | Database type (postgresql) |
| `db.statement` | SQL query (truncated) |
| `messaging.system` | Messaging system (kafka) |
| `messaging.destination` | Kafka topic name |

## Metrics (Prometheus)

### Scraped Metrics

Prometheus scrapes metrics from services via the OTel Collector's Prometheus exporter on port `8889`.

| Metric | Type | Description |
|---|---|---|
| `http_requests_total` | Counter | Total HTTP requests by service, method, path, status |
| `http_request_duration_seconds` | Histogram | HTTP request latency distribution |
| `db_query_duration_seconds` | Histogram | Database query latency |
| `kafka_produce_total` | Counter | Total Kafka messages produced |
| `kafka_consume_total` | Counter | Total Kafka messages consumed |
| `kafka_consumer_lag` | Gauge | Consumer group lag |
| `temporal_workflow_completed` | Counter | Completed Temporal workflows |
| `temporal_activity_duration_seconds` | Histogram | Temporal activity execution time |
| `ai_tokens_used_total` | Counter | Total AI tokens consumed |
| `ai_generation_duration_seconds` | Histogram | AI generation latency |

## Grafana Dashboards

Access Grafana at http://localhost:3300 (admin/admin in development).

### Pre-configured Dashboards

| Dashboard | Description |
|---|---|
| **Service Overview** | Request rates, latency percentiles, error rates across all services |
| **Pipeline Runs** | Test run counts, pass/fail ratios, average duration |
| **AI Service** | Generation counts, token usage, model distribution, feedback rates |
| **Database** | Query latency, connection pool usage, slow query logs |
| **Kafka/Redpanda** | Message throughput, consumer lag, topic sizes |
| **Temporal** | Workflow completion rates, activity durations, retry counts |
| **Infrastructure** | CPU, memory, disk usage per service |

### Dashboard Architecture

```mermaid
flowchart TD
    Grafana["Grafana :3300"]

    subgraph DataSources
        Prometheus["Prometheus<br/>Metrics"]
        Loki["Loki<br/>Logs"]
        Tempo["Tempo<br/>Traces"]
    end

    subgraph Dashboards
        D1["Service Overview"]
        D2["Pipeline Runs"]
        D3["AI Service"]
        D4["Database"]
        D5["Kafka/Redpanda"]
        D6["Temporal"]
    end

    Grafana --> Prometheus
    Grafana --> Loki
    Grafana --> Tempo

    D1 --> Prometheus
    D1 --> Loki
    D2 --> Prometheus
    D2 --> Loki
    D3 --> Prometheus
    D4 --> Prometheus
    D5 --> Prometheus
    D6 --> Prometheus
    D6 --> Tempo
```

## Alert Configuration

Alerts are defined in Grafana and triggered based on Prometheus metrics.

### Recommended Alerts

| Alert | Condition | Severity |
|---|---|---|
| **High Error Rate** | HTTP 5xx rate > 5% for 5 minutes | Critical |
| **High Latency** | p95 latency > 5s for 5 minutes | Warning |
| **Service Down** | Health check fails for 2 minutes | Critical |
| **Kafka Consumer Lag** | Lag > 1000 messages for 10 minutes | Warning |
| **Database Connection Pool** | Active connections > 80% of pool for 5 minutes | Warning |
| **Temporal Workflow Failures** | Workflow failure rate > 10% for 10 minutes | Warning |
| **AI Token Budget** | Daily token usage > 80% of budget | Warning |
| **Disk Usage** | Any volume > 80% capacity | Warning |

### Alert Notification Channels

Grafana alerts can be routed to:

- **Slack**: Via webhook integration
- **Email**: Via SMTP configuration
- **PagerDuty**: For critical production alerts
- **Webhook**: Custom integrations
