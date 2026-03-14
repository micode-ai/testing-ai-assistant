# Развёртывание

## Локальная разработка (Docker Compose)

### Запуск инфраструктуры

```bash
pnpm docker:up
```

### Остановка

```bash
pnpm docker:down
```

### Полный сброс (удаление данных)

```bash
pnpm docker:reset
```

### Состав docker-compose.yml

| Контейнер | Порт | Назначение |
|-----------|------|-----------|
| postgres-identity | 5441 | БД Identity Service |
| postgres-org | 5434 | БД Organization Service |
| postgres-project | 5437 | БД Project Service |
| postgres-pipeline | 5438 | БД Pipeline Service |
| postgres-notification | 5439 | БД Notification Service |
| postgres-ai | 5440 | БД AI Service |
| redis | 6380 | Кэш и чёрный список токенов |
| redpanda | 19092 | Брокер сообщений (Kafka) |
| redpanda-console | 18080 | Веб-консоль Redpanda |
| temporal | 7233 | Сервер Temporal |
| temporal-ui | 8233 | Веб-интерфейс Temporal |
| keycloak | 8180 | Провайдер аутентификации |
| minio | 19000/19001 | Хранилище артефактов |
| otel-collector | 4318 | OpenTelemetry Collector |
| grafana | 3300 | Визуализация метрик |
| prometheus | 9090 | Сбор метрик |
| loki | 3100 | Агрегация логов |
| tempo | 3200 | Хранение трейсов |

## Docker-образы сервисов

Каждый сервис имеет Dockerfile для продакшен-сборки:

```bash
# Сборка конкретного сервиса
docker build -t testing-ai/identity -f services/identity/Dockerfile .

# Сборка всех сервисов
docker compose -f docker-compose.prod.yml build
```

## Kubernetes (Helm)

### Структура Helm Charts

```
infrastructure/helm/
├── charts/
│   ├── identity/
│   ├── organization/
│   ├── project/
│   ├── pipeline/
│   ├── ai/
│   ├── notification/
│   ├── test-runner/
│   └── dashboard/
└── values/
    ├── dev.yaml
    ├── staging.yaml
    └── prod.yaml
```

### Установка

```bash
# Добавление зависимостей
helm dependency update infrastructure/helm

# Установка в dev-окружение
helm install testing-ai infrastructure/helm \
  -f infrastructure/helm/values/dev.yaml \
  -n testing-ai --create-namespace

# Обновление
helm upgrade testing-ai infrastructure/helm \
  -f infrastructure/helm/values/prod.yaml \
  -n testing-ai
```

### Конфигурация values.yaml

```yaml
# Пример values.yaml
global:
  imageRegistry: your-registry.io
  imagePullSecrets:
    - name: registry-secret

identity:
  replicas: 2
  image:
    tag: latest
  env:
    JWT_SECRET:
      valueFrom:
        secretKeyRef:
          name: identity-secrets
          key: jwt-secret

pipeline:
  replicas: 3
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 1Gi
```

## ArgoCD

Проект поддерживает GitOps-развёртывание через ArgoCD:

```
infrastructure/argocd/
├── application.yaml
├── project.yaml
└── appsets/
    ├── services.yaml
    └── infrastructure.yaml
```

### Настройка ArgoCD Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: testing-ai
  namespace: argocd
spec:
  project: testing-ai
  source:
    repoURL: https://github.com/your-org/testing-ai-assistant
    targetRevision: main
    path: infrastructure/helm
    helm:
      valueFiles:
        - values/prod.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: testing-ai
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

## Terraform

Инфраструктура как код для облачных ресурсов:

```
infrastructure/terraform/
├── main.tf
├── variables.tf
├── outputs.tf
├── modules/
│   ├── kubernetes/
│   ├── databases/
│   ├── redis/
│   ├── kafka/
│   └── monitoring/
└── environments/
    ├── dev/
    ├── staging/
    └── prod/
```

```bash
# Инициализация
cd infrastructure/terraform/environments/prod
terraform init

# План
terraform plan

# Применение
terraform apply
```

## CI/CD

### Рекомендуемый пайплайн

1. **Lint & Format** — проверка кода
2. **Test** — запуск unit и integration тестов
3. **Build** — сборка Docker-образов
4. **Push** — загрузка образов в реестр
5. **Deploy** — развёртывание через Helm/ArgoCD

### Переменные окружения для CI

```env
DOCKER_REGISTRY=your-registry.io
DOCKER_USERNAME=user
DOCKER_PASSWORD=password
KUBE_CONFIG=base64-encoded-kubeconfig
```
