# Быстрый старт

## Требования

| Компонент | Минимальная версия | Назначение |
|-----------|-------------------|------------|
| **Node.js** | >= 20.0.0 | Среда выполнения |
| **pnpm** | 9.15.4 | Менеджер пакетов |
| **Docker** | 24+ | Контейнеризация инфраструктуры |
| **Docker Compose** | 2.20+ | Оркестрация локальных контейнеров |
| **Git** | 2.40+ | Контроль версий |

## Пошаговая установка

### 1. Клонирование репозитория

```bash
git clone <repository-url> testing-ai-assistant
cd testing-ai-assistant
```

### 2. Установка зависимостей

```bash
# Установка pnpm (если не установлен)
corepack enable
corepack prepare pnpm@9.15.4 --activate

# Установка всех зависимостей monorepo
pnpm install
```

### 3. Настройка переменных окружения

```bash
# Копирование шаблона
cp .env.example .env
```

Отредактируйте файл `.env` согласно вашему окружению (см. раздел [Переменные окружения](#переменные-окружения)).

### 4. Запуск инфраструктуры

```bash
# Запуск всех контейнеров (PostgreSQL x8, Redis, Redpanda, Keycloak, MinIO, Temporal, Grafana stack)
pnpm docker:up
```

### 5. Выполнение миграций БД

```bash
# Генерация Prisma-клиентов и применение миграций
pnpm db:generate
pnpm db:migrate
```

### 6. Запуск в режиме разработки

```bash
# Запуск всех сервисов через Turborepo
pnpm dev
```

## Переменные окружения

### Identity Service

| Переменная | Значение по умолчанию | Описание |
|-----------|----------------------|----------|
| `IDENTITY_DB_URL` | `postgresql://postgres:postgres@localhost:5441/identity_db` | Строка подключения к БД |
| `IDENTITY_PORT` | `3001` | Порт сервиса |
| `JWT_SECRET` | `super-secret-dev-key-change-in-production` | Секретный ключ JWT |
| `JWT_EXPIRATION` | `1h` | Время жизни access token |
| `JWT_REFRESH_EXPIRATION` | `7d` | Время жизни refresh token |

### Organization Service

| Переменная | Значение по умолчанию | Описание |
|-----------|----------------------|----------|
| `ORG_DB_URL` | `postgresql://postgres:postgres@localhost:5434/org_db` | Строка подключения к БД |
| `ORG_PORT` | `3002` | Порт сервиса |

### Project Service

| Переменная | Значение по умолчанию | Описание |
|-----------|----------------------|----------|
| `PROJECT_DB_URL` | `postgresql://postgres:postgres@localhost:5437/project_db` | Строка подключения к БД |
| `PROJECT_PORT` | `3003` | Порт сервиса |

### Pipeline Service

| Переменная | Значение по умолчанию | Описание |
|-----------|----------------------|----------|
| `PIPELINE_DB_URL` | `postgresql://postgres:postgres@localhost:5438/pipeline_db` | Строка подключения к БД |
| `PIPELINE_PORT` | `3004` | Порт сервиса |

### AI Service

| Переменная | Значение по умолчанию | Описание |
|-----------|----------------------|----------|
| `AI_DB_URL` | `postgresql://postgres:postgres@localhost:5440/ai_db` | Строка подключения к БД |
| `AI_PORT` | `3005` | Порт сервиса |
| `OPENAI_API_KEY` | — | Ключ API OpenAI (обязателен) |
| `OPENAI_MODEL_FAST` | `gpt-4.1-mini` | Модель для быстрых запросов |
| `OPENAI_MODEL_ADVANCED` | `o3` | Модель для сложного анализа |

### Notification Service

| Переменная | Значение по умолчанию | Описание |
|-----------|----------------------|----------|
| `NOTIFICATION_DB_URL` | `postgresql://postgres:postgres@localhost:5439/notify_db` | Строка подключения к БД |
| `NOTIFICATION_PORT` | `3006` | Порт сервиса |
| `SMTP_HOST` | — | SMTP-сервер для email-уведомлений |
| `SMTP_PORT` | `587` | Порт SMTP |
| `SMTP_USER` | — | Пользователь SMTP |
| `SMTP_PASS` | — | Пароль SMTP |
| `SLACK_BOT_TOKEN` | — | Токен Slack-бота |
| `TELEGRAM_BOT_TOKEN` | — | Токен Telegram-бота |

### Keycloak

| Переменная | Значение по умолчанию | Описание |
|-----------|----------------------|----------|
| `KEYCLOAK_URL` | `http://localhost:8180` | URL Keycloak |
| `KEYCLOAK_REALM` | `testing-ai` | Realm в Keycloak |
| `KEYCLOAK_ADMIN` | `admin` | Логин администратора |
| `KEYCLOAK_ADMIN_PASSWORD` | `admin` | Пароль администратора |

### OAuth-провайдеры

| Переменная | Описание |
|-----------|----------|
| `GITHUB_CLIENT_ID` | Client ID приложения GitHub |
| `GITHUB_CLIENT_SECRET` | Client Secret приложения GitHub |
| `GITLAB_CLIENT_ID` | Client ID приложения GitLab |
| `GITLAB_CLIENT_SECRET` | Client Secret приложения GitLab |
| `BITBUCKET_CLIENT_ID` | Client ID приложения Bitbucket |
| `BITBUCKET_CLIENT_SECRET` | Client Secret приложения Bitbucket |

### Инфраструктура

| Переменная | Значение по умолчанию | Описание |
|-----------|----------------------|----------|
| `REDIS_URL` | `redis://localhost:6380` | Подключение к Redis |
| `KAFKA_BROKERS` | `localhost:19092` | Адрес брокеров Redpanda |
| `MINIO_ENDPOINT` | `localhost` | Хост MinIO |
| `MINIO_PORT` | `19000` | Порт MinIO |
| `MINIO_ACCESS_KEY` | `minioadmin` | Ключ доступа MinIO |
| `MINIO_SECRET_KEY` | `minioadmin` | Секретный ключ MinIO |
| `TEMPORAL_ADDRESS` | `localhost:7233` | Адрес сервера Temporal |

### Dashboard

| Переменная | Значение по умолчанию | Описание |
|-----------|----------------------|----------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | URL Identity API |
| `NEXTAUTH_URL` | `http://localhost:4200` | URL Dashboard |
| `NEXTAUTH_SECRET` | `nextauth-secret-dev-key` | Секрет NextAuth |
| `NEXT_PUBLIC_NOTIFICATION_API_URL` | `http://localhost:3006` | URL Notification API |
| `NEXT_PUBLIC_AI_API_URL` | `http://localhost:3005` | URL AI API |
| `NEXT_PUBLIC_PROJECT_API_URL` | `http://localhost:3003` | URL Project API |
| `NEXT_PUBLIC_PIPELINE_API_URL` | `http://localhost:3004` | URL Pipeline API |

### Наблюдаемость

| Переменная | Значение по умолчанию | Описание |
|-----------|----------------------|----------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | Эндпоинт OTel Collector |
| `OTEL_SERVICE_NAME` | `testing-ai` | Имя сервиса для трейсов |
| `GRAFANA_URL` | `http://localhost:3300` | URL Grafana |

## Проверка работоспособности

### Проверка контейнеров

```bash
docker compose ps
```

Все контейнеры должны быть в состоянии `running` или `healthy`.

### Проверка сервисов

| Сервис | URL Health Check |
|--------|-----------------|
| Identity | http://localhost:3001/health |
| Organization | http://localhost:3002/health |
| Project | http://localhost:3003/health |
| Pipeline | http://localhost:3004/health |
| AI | http://localhost:3005/health |
| Notification | http://localhost:3006/health |

### Проверка инфраструктуры

| Сервис | URL |
|--------|-----|
| Dashboard | http://localhost:4200 |
| Keycloak Console | http://localhost:8180 |
| Temporal UI | http://localhost:8233 |
| Redpanda Console | http://localhost:18080 |
| MinIO Console | http://localhost:19001 |
| Grafana | http://localhost:3300 |
| Prometheus | http://localhost:9090 |

### Проверка через curl

```bash
# Identity Service
curl http://localhost:3001/health

# Регистрация тестового пользователя
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "name": "Test User", "password": "Password123!"}'
```

## Полезные команды

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Запуск всех сервисов в режиме разработки |
| `pnpm build` | Сборка всех пакетов |
| `pnpm lint` | Линтинг всего кода |
| `pnpm test` | Запуск всех тестов |
| `pnpm format` | Форматирование кода (Prettier) |
| `pnpm format:check` | Проверка форматирования |
| `pnpm clean` | Очистка артефактов сборки |
| `pnpm docker:up` | Запуск инфраструктуры |
| `pnpm docker:down` | Остановка инфраструктуры |
| `pnpm docker:reset` | Сброс и перезапуск (удаление volumes) |
| `pnpm db:migrate` | Применение миграций БД |
| `pnpm db:generate` | Генерация Prisma-клиентов |
