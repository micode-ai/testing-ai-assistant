# Rozwiązywanie problemów

## Problemy z instalacją

### Kontenery Docker nie uruchamiają się

**Objaw:** `docker compose ps` pokazuje kontenery w statusie `restarting` lub `exited`.

**Rozwiązania:**

1. Sprawdź, czy porty nie są już zajęte:
   ```bash
   netstat -tulpn | grep -E '(5441|5434|5437|5438|5439|5440|6380|19092)'
   ```

2. Sprawdź logi kontenera:
   ```bash
   docker compose logs <container-name>
   ```

3. Pełny reset i restart:
   ```bash
   pnpm docker:reset
   ```

4. Upewnij się, że Docker ma wystarczające zasoby (minimum 8 GB RAM).

### pnpm install kończy się błędem

**Rozwiązania:**

1. Upewnij się, że używasz właściwej wersji Node.js (>= 20):
   ```bash
   node --version
   ```

2. Wyczyść cache:
   ```bash
   pnpm store prune
   rm -rf node_modules
   pnpm install
   ```

### Migracje bazy danych nie działają

**Objaw:** `pnpm db:migrate` kończy się błędem połączenia.

**Rozwiązania:**

1. Upewnij się, że kontenery PostgreSQL działają i mają status `healthy`:
   ```bash
   docker compose ps | grep postgres
   ```

2. Zweryfikuj URL połączenia w `.env`:
   ```bash
   docker compose exec postgres-identity pg_isready
   ```

3. Poczekaj 1-2 minuty po `docker:up` — bazy danych mogą się jeszcze inicjalizować.

## Problemy z uruchomieniem

### Serwis nie uruchamia się

**Objaw:** Błąd podczas `pnpm dev`.

**Rozwiązania:**

1. Upewnij się, że klienci Prisma są wygenerowani:
   ```bash
   pnpm db:generate
   ```

2. Sprawdź `.env` — wszystkie wymagane zmienne muszą być ustawione.

3. Uruchom konkretny serwis dla szczegółowego błędu:
   ```bash
   cd services/identity
   npm run dev
   ```

### Port już jest zajęty

**Objaw:** `EADDRINUSE: address already in use`.

**Rozwiązania:**

1. Znajdź proces używający portu:
   ```bash
   lsof -i :<port>    # macOS/Linux
   netstat -ano | findstr :<port>    # Windows
   ```

2. Zakończ proces lub zmień port w `.env`.

## Problemy z uwierzytelnianiem

### 401 Unauthorized

**Możliwe przyczyny:**

1. **Access token wygasł** — odśwież przez `POST /auth/refresh`
2. **Token na czarnej liście** — zaloguj się ponownie
3. **Zły format nagłówka** — powinien być `Authorization: Bearer <token>`

### OAuth nie działa

**Rozwiązania:**

1. Zweryfikuj `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` w `.env`
2. Upewnij się, że callback URL w ustawieniach aplikacji OAuth się zgadza
3. Sprawdź logi Identity Service

## Problemy z webhookami

### Webhook nie tworzy się

**Możliwe przyczyny:**

1. Brak uprawnień administratora w repozytorium
2. Token OAuth nie ma wymaganych scopes
3. URL aplikacji niedostępny z internetu (dla lokalnego środowiska użyj ngrok)

### Webhook nie uruchamia pipeline'u

**Rozwiązania:**

1. Sprawdź status webhooka u dostawcy Git
2. Sprawdź logi Project Service
3. Upewnij się, że pipeline jest aktywny (`enabled: true`)

## Problemy z generowaniem AI

### Generowanie AI zawiesza się

**Rozwiązania:**

1. Zweryfikuj `OPENAI_API_KEY` w `.env`
2. Sprawdź logi AI Service:
   ```bash
   docker compose logs ai-service
   ```
3. Upewnij się, że quota API OpenAI nie jest wyczerpana

### Niska jakość wyników generowania

**Rozwiązania:**

1. Użyj mocniejszego modelu: `OPENAI_MODEL_ADVANCED=o3`
2. Zapewnij agentowi AI dostęp do kodu projektu
3. Zostawiaj informację zwrotną przez `PATCH /ai/generations/:id/feedback`

## Problemy z przebiegami testowymi

### Przebieg zawieszony w statusie RUNNING

**Rozwiązania:**

1. Sprawdź Temporal UI: http://localhost:8233
2. Sprawdź logi Test Runner
3. Anuluj przebieg:
   ```bash
   curl -X POST http://localhost:3004/test-runs/<id>/cancel \
     -H "Authorization: Bearer <token>"
   ```

### Przebieg zakończył się z ERROR

**Rozwiązania:**

1. Sprawdź logi przebiegu w widoku szczegółowym
2. Zweryfikuj, że Temporal i MinIO działają
3. Upewnij się, że repozytorium Git jest dostępne

## Problemy z powiadomieniami

### Email nie wysyła się

**Rozwiązania:**

1. Sprawdź ustawienia SMTP w `.env`
2. Dla Gmaila — użyj App Password, nie zwykłego hasła
3. Sprawdź logi Notification Service

### Powiadomienia Slack nie przychodzą

**Rozwiązania:**

1. Zweryfikuj `SLACK_BOT_TOKEN`
2. Upewnij się, że bot jest dodany do docelowego kanału
3. Sprawdź scopes bota: potrzebny jest `chat:write`

## Problemy z wydajnością

### Wysokie opóźnienia

**Rozwiązania:**

1. Sprawdź metryki w Grafanie
2. Zweryfikuj, czy bazy danych nie są przeciążone:
   ```bash
   docker stats
   ```
3. Zwiększ zasoby Docker (RAM, CPU)

### Wycieki pamięci

**Rozwiązania:**

1. Monitoruj zużycie przez `docker stats`
2. Sprawdź heap Node.js przez ślady
3. Zrestartuj problematyczny serwis

## Przydatne polecenia diagnostyczne

```bash
# Status wszystkich kontenerów
docker compose ps

# Logi konkretnego serwisu
docker compose logs -f <service-name>

# Zużycie zasobów
docker stats

# Sprawdzenie połączenia z bazą danych
docker compose exec postgres-identity pg_isready

# Sprawdzenie Redis
docker compose exec redis redis-cli ping

# Sprawdzenie endpointów health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
curl http://localhost:3006/health
```
