# Начало работы

## Системные требования

| Компонент | Минимальная версия |
|-----------|-------------------|
| Node.js | >= 20.0.0 |
| pnpm | >= 9.15.4 |
| Docker | >= 24.0 |
| Docker Compose | >= 2.20.0 |
| Git | >= 2.40.0 |

**Рекомендуемые аппаратные ресурсы:**
- RAM: 16 ГБ (минимум 8 ГБ)
- Диск: 10 ГБ свободного пространства
- CPU: 4+ ядер

## Установка

### 1. Клонирование репозитория

```bash
git clone https://github.com/your-org/testing-ai-assistant.git
cd testing-ai-assistant
```

### 2. Настройка переменных окружения

```bash
cp .env.example .env
```

Откройте `.env` и укажите необходимые значения. Минимальная конфигурация для локальной разработки:

```env
# JWT (обязательно — замените в продакшене)
JWT_SECRET=super-secret-dev-key-change-in-production
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d

# Dashboard
NEXTAUTH_SECRET=nextauth-secret-dev-key
NEXTAUTH_URL=http://localhost:4200

# AI (необходим для AI-функций)
OPENAI_API_KEY=sk-ваш-ключ
```

Остальные переменные (базы данных, Redis, Kafka и т.д.) уже заполнены значениями для локальной разработки.

### 3. Запуск инфраструктуры

```bash
pnpm docker:up
```

Эта команда поднимает все инфраструктурные контейнеры:
- 6 баз данных PostgreSQL
- Redis
- Redpanda (Kafka)
- Temporal + Temporal UI
- Keycloak
- MinIO
- OpenTelemetry Collector
- Grafana, Prometheus, Loki, Tempo

Проверьте, что все контейнеры запущены:

```bash
docker compose ps
```

Подождите, пока все контейнеры перейдут в статус `healthy` (1-2 минуты).

### 4. Установка зависимостей

```bash
pnpm install
```

### 5. Генерация клиентов Prisma и миграция БД

```bash
pnpm db:generate
pnpm db:migrate
```

### 6. Запуск в режиме разработки

```bash
pnpm dev
```

Эта команда запускает все микросервисы и приложения через Turborepo.

## URL-адреса для разработки

| Сервис | URL |
|--------|-----|
| Веб-панель (Dashboard) | http://localhost:4200 |
| Identity Service | http://localhost:3001 |
| Organization Service | http://localhost:3002 |
| Project Service | http://localhost:3003 |
| Pipeline Service | http://localhost:3004 |
| AI Service | http://localhost:3005 |
| Notification Service | http://localhost:3006 |
| Keycloak | http://localhost:8180 |
| Temporal UI | http://localhost:8233 |
| Redpanda Console | http://localhost:18080 |
| MinIO Console | http://localhost:19001 |
| Grafana | http://localhost:3300 (admin/admin) |
| Prometheus | http://localhost:9090 |

## Быстрая проверка

После запуска проверьте работоспособность сервисов:

```bash
# Проверка Identity Service
curl http://localhost:3001/health

# Проверка Pipeline Service
curl http://localhost:3004/health
```

Все эндпоинты `/health` должны возвращать статус `200 OK`.

## Полезные команды

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Запуск всех сервисов в режиме разработки |
| `pnpm build` | Сборка всех пакетов |
| `pnpm lint` | Проверка кода линтером |
| `pnpm test` | Запуск тестов |
| `pnpm format` | Форматирование кода |
| `pnpm clean` | Очистка артефактов сборки |
| `pnpm docker:up` | Запуск инфраструктуры |
| `pnpm docker:down` | Остановка инфраструктуры |
| `pnpm docker:reset` | Полный сброс инфраструктуры (удаление данных) |
| `pnpm db:generate` | Генерация клиентов Prisma |
| `pnpm db:migrate` | Применение миграций БД |

## Что дальше?

- [Архитектура](./02-architecture.md) — изучите структуру системы
- [Веб-панель](./03-dashboard.md) — начните работу с интерфейсом
- [Организации и проекты](./05-organizations-projects.md) — создайте первую организацию
