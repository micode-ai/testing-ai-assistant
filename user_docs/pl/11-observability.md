# Monitoring i obserwowalność

## Przegląd

Platforma wykorzystuje stos OpenTelemetry + Grafana do pełnej obserwowalności: logi, ślady i metryki.

## Komponenty

| Komponent | URL | Przeznaczenie |
|-----------|-----|--------------|
| Grafana | http://localhost:3300 | Wizualizacja (admin/admin) |
| Prometheus | http://localhost:9090 | Zbieranie i przechowywanie metryk |
| Loki | http://localhost:3100 | Agregacja logów |
| Tempo | http://localhost:3200 | Rozproszone ślady |
| OTel Collector | http://localhost:4318 | Odbieranie telemetrii |

## OpenTelemetry

Wszystkie mikroserwisy są instrumentowane przez pakiet `@testing-ai/tracing`:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=testing-ai
```

### Automatyczna instrumentacja

Pakiet `@testing-ai/tracing` automatycznie instrumentuje:

- Żądania HTTP (przychodzące i wychodzące)
- Zapytania PostgreSQL (przez Prisma)
- Operacje Redis
- Wiadomości Kafka (Redpanda)
- Komponenty NestJS (kontrolery, guardy, pipe)

### Niestandardowe spany

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('my-service');
const span = tracer.startSpan('my-operation');
try {
  // ... twój kod
} finally {
  span.end();
}
```

## Logi (Loki)

### Przeglądanie w Grafanie

1. Otwórz Grafana → Explore
2. Wybierz źródło danych: **Loki**
3. Użyj LogQL do zapytań:

```logql
# Wszystkie logi Identity Service
{service_name="identity-service"}

# Błędy we wszystkich serwisach
{service_name=~".+"} |= "error"

# Logi konkretnego żądania po trace ID
{service_name=~".+"} |= "trace_id=abc123"
```

### Struktura logów

Wszystkie serwisy używają strukturowanego logowania (JSON):

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

## Ślady (Tempo)

### Przeglądanie w Grafanie

1. Otwórz Grafana → Explore
2. Wybierz źródło danych: **Tempo**
3. Szukaj po Trace ID lub przez zapytanie

### Struktura śladu

Typowy ślad przebiegu testowego:

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

## Metryki (Prometheus)

### Przeglądanie w Grafanie

1. Otwórz Grafana → Explore
2. Wybierz źródło danych: **Prometheus**
3. Użyj PromQL do zapytań

### Kluczowe metryki

```promql
# Żądania HTTP według serwisu
http_requests_total{service="identity-service"}

# Opóźnienie żądań (p99)
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Aktywne przebiegi testowe
test_runs_active_total

# Liczba generowań AI
ai_generations_total{type="TEST_GENERATION"}

# Błędy według serwisu
http_requests_total{status_code=~"5.."}
```

## Dashboardy Grafana

### Wstępnie skonfigurowane dashboardy

Konfiguracje dashboardów znajdują się w `infrastructure/observability/`:

- **System Overview** — ogólny widok wszystkich serwisów
- **Service Health** — stan pojedynczego serwisu
- **Test Runs** — metryki przebiegów testowych
- **AI Generations** — statystyki generowań AI
- **Database Performance** — wydajność bazy danych

### Dostęp

1. Otwórz http://localhost:3300
2. Login: `admin` / Hasło: `admin`
3. Przejdź do Dashboards

## Alerty

Konfiguracja alertów przez Grafanę:

1. Otwórz dashboard → panel
2. Kliknij Edit → Alert
3. Skonfiguruj warunek i kanał powiadomień

### Zalecane alerty

- Serwis nie odpowiada na `/health` > 30 sekund
- Opóźnienie p99 > 5 sekund
- Liczba błędów 5xx > 10 w 5 minut
- Przebieg testowy w statusie RUNNING > 30 minut
- Pokrycie kodu spadło o > 5%
