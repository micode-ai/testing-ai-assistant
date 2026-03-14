# Monitoring & Observability

## Overview

The platform uses the OpenTelemetry + Grafana stack for full observability: logs, traces, and metrics.

## Components

| Component | URL | Purpose |
|-----------|-----|---------|
| Grafana | http://localhost:3300 | Visualization (admin/admin) |
| Prometheus | http://localhost:9090 | Metric collection and storage |
| Loki | http://localhost:3100 | Log aggregation |
| Tempo | http://localhost:3200 | Distributed traces |
| OTel Collector | http://localhost:4318 | Telemetry ingestion |

## OpenTelemetry

All microservices are instrumented via the `@testing-ai/tracing` package:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=testing-ai
```

### Automatic Instrumentation

The `@testing-ai/tracing` package automatically instruments:

- HTTP requests (incoming and outgoing)
- PostgreSQL queries (via Prisma)
- Redis operations
- Kafka messages (Redpanda)
- NestJS components (controllers, guards, pipes)

### Custom Spans

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('my-service');
const span = tracer.startSpan('my-operation');
try {
  // ... your code
} finally {
  span.end();
}
```

## Logs (Loki)

### Viewing in Grafana

1. Open Grafana → Explore
2. Select data source: **Loki**
3. Use LogQL for queries:

```logql
# All Identity Service logs
{service_name="identity-service"}

# Errors across all services
{service_name=~".+"} |= "error"

# Logs for a specific request by trace ID
{service_name=~".+"} |= "trace_id=abc123"
```

### Log Structure

All services use structured logging (JSON):

```json
{
  "level": "info",
  "message": "Test run created",
  "service": "pipeline-service",
  "traceId": "abc123",
  "spanId": "def456",
  "testRunId": "uuid",
  "timestamp": "2026-03-12T10:00:00Z"
}
```

## Traces (Tempo)

### Viewing in Grafana

1. Open Grafana → Explore
2. Select data source: **Tempo**
3. Search by Trace ID or query

### Trace Structure

Typical test run trace:

```
[Pipeline Service] POST /test-runs
  └── [Pipeline Service] Create test run in DB
  └── [Pipeline Service] Publish event to Redpanda
      └── [Test Runner] Handle test-run.created
          └── [Test Runner] Clone repository
          └── [Test Runner] Install dependencies
          └── [Test Runner] Run unit tests
          └── [Test Runner] Run E2E tests
          └── [Test Runner] Upload artifacts to MinIO
          └── [Test Runner] Publish results event
              └── [Pipeline Service] Handle test-run.completed
              └── [Notification Service] Send notifications
```

## Metrics (Prometheus)

### Viewing in Grafana

1. Open Grafana → Explore
2. Select data source: **Prometheus**
3. Use PromQL for queries

### Key Metrics

```promql
# HTTP requests by service
http_requests_total{service="identity-service"}

# Request latency (p99)
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Active test runs
test_runs_active_total

# AI generation count
ai_generations_total{type="TEST_GENERATION"}

# Errors by service
http_requests_total{status_code=~"5.."}
```

## Grafana Dashboards

### Pre-configured Dashboards

Dashboard configurations are in `infrastructure/observability/`:

- **System Overview** — overall view of all services
- **Service Health** — individual service health
- **Test Runs** — test run metrics
- **AI Generations** — AI generation statistics
- **Database Performance** — database performance

### Access

1. Open http://localhost:3300
2. Login: `admin` / Password: `admin`
3. Navigate to Dashboards

## Alerts

Configure alerts via Grafana:

1. Open dashboard → panel
2. Click Edit → Alert
3. Configure condition and notification channel

### Recommended Alerts

- Service not responding to `/health` > 30 seconds
- p99 latency > 5 seconds
- 5xx error count > 10 in 5 minutes
- Test run in RUNNING status > 30 minutes
- Code coverage decreased by > 5%
