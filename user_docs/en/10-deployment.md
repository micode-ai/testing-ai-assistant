# Deployment

## Local Development (Docker Compose)

### Start Infrastructure

```bash
pnpm docker:up
```

### Stop

```bash
pnpm docker:down
```

### Full Reset (delete data)

```bash
pnpm docker:reset
```

### docker-compose.yml Contents

| Container | Port | Purpose |
|-----------|------|---------|
| postgres-identity | 5441 | Identity Service DB |
| postgres-org | 5434 | Organization Service DB |
| postgres-project | 5437 | Project Service DB |
| postgres-pipeline | 5438 | Pipeline Service DB |
| postgres-notification | 5439 | Notification Service DB |
| postgres-ai | 5440 | AI Service DB |
| redis | 6380 | Cache and token blacklist |
| redpanda | 19092 | Message broker (Kafka) |
| redpanda-console | 18080 | Redpanda web console |
| temporal | 7233 | Temporal server |
| temporal-ui | 8233 | Temporal web UI |
| keycloak | 8180 | Authentication provider |
| minio | 19000/19001 | Artifact storage |
| otel-collector | 4318 | OpenTelemetry Collector |
| grafana | 3300 | Metrics visualization |
| prometheus | 9090 | Metric collection |
| loki | 3100 | Log aggregation |
| tempo | 3200 | Trace storage |

## Service Docker Images

Each service has a Dockerfile for production builds:

```bash
# Build a specific service
docker build -t testing-ai/identity -f services/identity/Dockerfile .

# Build all services
docker compose -f docker-compose.prod.yml build
```

## Kubernetes (Helm)

### Helm Charts Structure

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

### Installation

```bash
# Update dependencies
helm dependency update infrastructure/helm

# Install to dev environment
helm install testing-ai infrastructure/helm \
  -f infrastructure/helm/values/dev.yaml \
  -n testing-ai --create-namespace

# Upgrade
helm upgrade testing-ai infrastructure/helm \
  -f infrastructure/helm/values/prod.yaml \
  -n testing-ai
```

### values.yaml Configuration

```yaml
# Example values.yaml
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

The project supports GitOps deployment via ArgoCD:

```
infrastructure/argocd/
├── application.yaml
├── project.yaml
└── appsets/
    ├── services.yaml
    └── infrastructure.yaml
```

### ArgoCD Application Setup

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

Infrastructure as Code for cloud resources:

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
# Initialize
cd infrastructure/terraform/environments/prod
terraform init

# Plan
terraform plan

# Apply
terraform apply
```

## CI/CD

### Recommended Pipeline

1. **Lint & Format** — code quality checks
2. **Test** — run unit and integration tests
3. **Build** — build Docker images
4. **Push** — push images to registry
5. **Deploy** — deploy via Helm/ArgoCD

### CI Environment Variables

```env
DOCKER_REGISTRY=your-registry.io
DOCKER_USERNAME=user
DOCKER_PASSWORD=password
KUBE_CONFIG=base64-encoded-kubeconfig
```
