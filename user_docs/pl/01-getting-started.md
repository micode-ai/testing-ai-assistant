# Pierwsze kroki

## Wymagania systemowe

| Komponent | Minimalna wersja |
|-----------|-----------------|
| Node.js | >= 20.0.0 |
| pnpm | >= 9.15.4 |
| Docker | >= 24.0 |
| Docker Compose | >= 2.20.0 |
| Git | >= 2.40.0 |

**Zalecane zasoby sprzętowe:**
- RAM: 16 GB (minimum 8 GB)
- Dysk: 10 GB wolnego miejsca
- CPU: 4+ rdzeni

## Instalacja

### 1. Klonowanie repozytorium

```bash
git clone https://github.com/your-org/testing-ai-assistant.git
cd testing-ai-assistant
```

### 2. Konfiguracja zmiennych środowiskowych

```bash
cp .env.example .env
```

Otwórz `.env` i ustaw wymagane wartości. Minimalna konfiguracja dla lokalnego środowiska:

```env
# JWT (wymagane — zmień na produkcji)
JWT_SECRET=super-secret-dev-key-change-in-production
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d

# Dashboard
NEXTAUTH_SECRET=nextauth-secret-dev-key
NEXTAUTH_URL=http://localhost:4200

# AI (wymagane dla funkcji AI)
OPENAI_API_KEY=sk-twoj-klucz
```

Pozostałe zmienne (bazy danych, Redis, Kafka itd.) są już wypełnione wartościami dla lokalnego środowiska.

### 3. Uruchomienie infrastruktury

```bash
pnpm docker:up
```

To polecenie uruchamia wszystkie kontenery infrastrukturalne:
- 6 baz danych PostgreSQL
- Redis
- Redpanda (Kafka)
- Temporal + Temporal UI
- Keycloak
- MinIO
- OpenTelemetry Collector
- Grafana, Prometheus, Loki, Tempo

Sprawdź, czy wszystkie kontenery działają:

```bash
docker compose ps
```

Poczekaj, aż wszystkie kontenery osiągną status `healthy` (1-2 minuty).

### 4. Instalacja zależności

```bash
pnpm install
```

### 5. Generowanie klientów Prisma i migracja bazy danych

```bash
pnpm db:generate
pnpm db:migrate
```

### 6. Uruchomienie w trybie deweloperskim

```bash
pnpm dev
```

To polecenie uruchamia wszystkie mikroserwisy i aplikacje przez Turborepo.

## Adresy URL dla środowiska deweloperskiego

| Serwis | URL |
|--------|-----|
| Panel webowy (Dashboard) | http://localhost:4200 |
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

## Szybka weryfikacja

Po uruchomieniu sprawdź działanie serwisów:

```bash
# Sprawdź Identity Service
curl http://localhost:3001/health

# Sprawdź Pipeline Service
curl http://localhost:3004/health
```

Wszystkie endpointy `/health` powinny zwracać status `200 OK`.

## Przydatne polecenia

| Polecenie | Opis |
|-----------|------|
| `pnpm dev` | Uruchom wszystkie serwisy w trybie deweloperskim |
| `pnpm build` | Zbuduj wszystkie pakiety |
| `pnpm lint` | Uruchom linter |
| `pnpm test` | Uruchom testy |
| `pnpm format` | Sformatuj kod |
| `pnpm clean` | Wyczyść artefakty budowania |
| `pnpm docker:up` | Uruchom infrastrukturę |
| `pnpm docker:down` | Zatrzymaj infrastrukturę |
| `pnpm docker:reset` | Pełny reset infrastruktury (usuwa dane) |
| `pnpm db:generate` | Generuj klientów Prisma |
| `pnpm db:migrate` | Zastosuj migracje bazy danych |

## Co dalej?

- [Architektura](./02-architecture.md) — poznaj strukturę systemu
- [Panel webowy](./03-dashboard.md) — zacznij korzystać z interfejsu
- [Organizacje i projekty](./05-organizations-projects.md) — utwórz pierwszą organizację
