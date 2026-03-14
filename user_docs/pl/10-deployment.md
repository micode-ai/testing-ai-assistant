# Wdrożenie

## Lokalne środowisko (Docker Compose)

### Uruchomienie infrastruktury

```bash
pnpm docker:up
```

### Zatrzymanie

```bash
pnpm docker:down
```

### Pełny reset (usunięcie danych)

```bash
pnpm docker:reset
```

### Zawartość docker-compose.yml

| Kontener | Port | Przeznaczenie |
|----------|------|--------------|
| postgres-identity | 5441 | Baza danych Identity Service |
| postgres-org | 5434 | Baza danych Organization Service |
| postgres-project | 5437 | Baza danych Project Service |
| postgres-pipeline | 5438 | Baza danych Pipeline Service |
| postgres-notification | 5439 | Baza danych Notification Service |
| postgres-ai | 5440 | Baza danych AI Service |
| redis | 6380 | Cache i czarna lista tokenów |
| redpanda | 19092 | Broker wiadomości (Kafka) |
| redpanda-console | 18080 | Konsola webowa Redpanda |
| temporal | 7233 | Serwer Temporal |
| temporal-ui | 8233 | Interfejs webowy Temporal |
| keycloak | 8180 | Dostawca uwierzytelniania |
| minio | 19000/19001 | Magazyn artefaktów |
| otel-collector | 4318 | OpenTelemetry Collector |
| grafana | 3300 | Wizualizacja metryk |
| prometheus | 9090 | Zbieranie metryk |
| loki | 3100 | Agregacja logów |
| tempo | 3200 | Przechowywanie śladów |

## Obrazy Docker serwisów

Każdy serwis ma Dockerfile do budowania produkcyjnego:

```bash
# Budowanie konkretnego serwisu
docker build -t testing-ai/identity -f services/identity/Dockerfile .

# Budowanie wszystkich serwisów
docker compose -f docker-compose.prod.yml build
```

## Kubernetes (Helm)

### Struktura Helm Charts

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

### Instalacja

```bash
# Aktualizacja zależności
helm dependency update infrastructure/helm

# Instalacja w środowisku dev
helm install testing-ai infrastructure/helm \
  -f infrastructure/helm/values/dev.yaml \
  -n testing-ai --create-namespace

# Aktualizacja
helm upgrade testing-ai infrastructure/helm \
  -f infrastructure/helm/values/prod.yaml \
  -n testing-ai
```

### Konfiguracja values.yaml

```yaml
# Przykład values.yaml
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

Projekt wspiera wdrażanie GitOps przez ArgoCD:

```
infrastructure/argocd/
├── application.yaml
├── project.yaml
└── appsets/
    ├── services.yaml
    └── infrastructure.yaml
```

### Konfiguracja ArgoCD Application

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

Infrastruktura jako kod dla zasobów chmurowych:

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
# Inicjalizacja
cd infrastructure/terraform/environments/prod
terraform init

# Plan
terraform plan

# Zastosowanie
terraform apply
```

## CI/CD

### Zalecany pipeline

1. **Lint & Format** — sprawdzenie jakości kodu
2. **Test** — uruchomienie testów jednostkowych i integracyjnych
3. **Build** — budowanie obrazów Docker
4. **Push** — przesłanie obrazów do rejestru
5. **Deploy** — wdrożenie przez Helm/ArgoCD

### Zmienne środowiskowe CI

```env
DOCKER_REGISTRY=your-registry.io
DOCKER_USERNAME=user
DOCKER_PASSWORD=password
KUBE_CONFIG=base64-encoded-kubeconfig
```
