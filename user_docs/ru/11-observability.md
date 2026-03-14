# Мониторинг и наблюдаемость

## Обзор

Платформа использует стек OpenTelemetry + Grafana для полной наблюдаемости: логи, трейсы и метрики.

## Компоненты

| Компонент | URL | Назначение |
|-----------|-----|-----------|
| Grafana | http://localhost:3300 | Визуализация (admin/admin) |
| Prometheus | http://localhost:9090 | Сбор и хранение метрик |
| Loki | http://localhost:3100 | Агрегация логов |
| Tempo | http://localhost:3200 | Распределённые трейсы |
| OTel Collector | http://localhost:4318 | Приём телеметрии |

## OpenTelemetry

Все микросервисы инструментированы через пакет `@testing-ai/tracing`:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=testing-ai
```

### Автоматическая инструментация

Пакет `@testing-ai/tracing` автоматически инструментирует:

- HTTP-запросы (входящие и исходящие)
- PostgreSQL-запросы (через Prisma)
- Redis-операции
- Kafka-сообщения (Redpanda)
- NestJS-компоненты (контроллеры, гарды, pipe)

### Пользовательские спаны

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('my-service');
const span = tracer.startSpan('my-operation');
try {
  // ... ваш код
} finally {
  span.end();
}
```

## Логи (Loki)

### Просмотр в Grafana

1. Откройте Grafana → Explore
2. Выберите источник данных: **Loki**
3. Используйте LogQL для запросов:

```logql
# Все логи Identity Service
{service_name="identity-service"}

# Ошибки во всех сервисах
{service_name=~".+"} |= "error"

# Логи конкретного запроса по trace ID
{service_name=~".+"} |= "trace_id=abc123"
```

### Структура логов

Все сервисы используют структурированное логирование (JSON):

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

## Трейсы (Tempo)

### Просмотр в Grafana

1. Откройте Grafana → Explore
2. Выберите источник данных: **Tempo**
3. Поиск по Trace ID или через запрос

### Структура трейса

Типичный трейс тестового прогона:

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

## Метрики (Prometheus)

### Просмотр в Grafana

1. Откройте Grafana → Explore
2. Выберите источник данных: **Prometheus**
3. Используйте PromQL для запросов

### Ключевые метрики

```promql
# Количество HTTP-запросов по сервисам
http_requests_total{service="identity-service"}

# Латентность запросов (p99)
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))

# Активные тестовые прогоны
test_runs_active_total

# Количество AI-генераций
ai_generations_total{type="TEST_GENERATION"}

# Ошибки по сервисам
http_requests_total{status_code=~"5.."}
```

## Дашборды Grafana

### Предустановленные дашборды

Конфигурации дашбордов находятся в `infrastructure/observability/`:

- **System Overview** — общий обзор всех сервисов
- **Service Health** — здоровье отдельного сервиса
- **Test Runs** — метрики тестовых прогонов
- **AI Generations** — статистика AI-генераций
- **Database Performance** — производительность БД

### Доступ

1. Откройте http://localhost:3300
2. Логин: `admin` / Пароль: `admin`
3. Перейдите в Dashboards

## Алерты

Настройка алертов через Grafana:

1. Откройте дашборд → панель
2. Нажмите Edit → Alert
3. Настройте условие и канал уведомления

### Рекомендуемые алерты

- Сервис не отвечает на `/health` > 30 секунд
- Латентность p99 > 5 секунд
- Количество ошибок 5xx > 10 за 5 минут
- Тестовый прогон в статусе RUNNING > 30 минут
- Покрытие кода снизилось на > 5%
