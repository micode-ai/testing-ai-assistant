# Bezpieczeństwo

## Uwierzytelnianie

### Tokeny JWT

System wykorzystuje JWT do bezstanowego uwierzytelniania:

- **Access Token** — krótkotrwały (domyślnie 1 godzina)
- **Refresh Token** — długotrwały (domyślnie 7 dni)

```env
JWT_SECRET=twoj-tajny-klucz     # Koniecznie zmień na produkcji!
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d
```

### Proces uwierzytelniania

1. Użytkownik wysyła login/hasło na `POST /auth/login`
2. Serwer weryfikuje dane i zwraca parę tokenów
3. Klient przesyła access token w nagłówku `Authorization: Bearer <token>`
4. Po wygaśnięciu access tokenu, klient odświeża go przez `POST /auth/refresh`
5. Przy wylogowaniu refresh token jest dodawany do czarnej listy (Redis)

### Czarna lista tokenów

Unieważnione tokeny są przechowywane w Redis z TTL równym czasowi życia tokenu. Przy każdym żądaniu sprawdzane jest, czy token nie znajduje się na czarnej liście.

### OAuth2

Obsługiwani dostawcy:

| Dostawca | Endpoint |
|----------|----------|
| GitHub | `/auth/github`, `/auth/github/callback` |
| GitLab | `/auth/gitlab`, `/auth/gitlab/callback` |
| Bitbucket | `/auth/bitbucket`, `/auth/bitbucket/callback` |

Konfiguracja:

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITLAB_CLIENT_ID=...
GITLAB_CLIENT_SECRET=...
BITBUCKET_CLIENT_ID=...
BITBUCKET_CLIENT_SECRET=...
```

### Keycloak (opcjonalnie)

Dla korporacyjnego SSO można zintegrować Keycloak:

- Dostęp: http://localhost:8180
- Identity Service synchronizuje użytkowników z Keycloak
- Wsparcie protokołów OIDC/SAML

## Autoryzacja

### RBAC (kontrola dostępu oparta na rolach)

Role są definiowane na poziomie organizacji:

| Rola | Uprawnienia |
|------|-------------|
| `ADMIN` | Pełny dostęp: zarządzanie członkami, ustawienia, usuwanie |
| `MEMBER` | Praca z projektami, pipeline'ami, uruchamianie testów |
| `VIEWER` | Tylko odczyt: przeglądanie projektów i wyników |

### Guards (NestJS)

Każdy endpoint jest chroniony przez NestJS Guards:

- **JwtAuthGuard** — weryfikacja tokenu JWT
- **RolesGuard** — weryfikacja roli użytkownika
- **OrgMemberGuard** — weryfikacja członkostwa w organizacji

## Przechowywanie haseł

- Hasła są haszowane przez `bcryptjs` z salt rounds = 10
- Oryginalne hasła nigdy nie są przechowywane
- Weryfikacja używa `bcrypt.compare()`

## Bezpieczeństwo API

### Walidacja danych wejściowych

Wszystkie dane wejściowe są walidowane przez:

- `class-validator` — dekoratory walidacji na DTO
- `class-transformer` — transformacja i sanityzacja
- `zod` — walidacja schematu (Dashboard)

### Rate Limiting

Traefik zapewnia rate limiting na poziomie API Gateway:

- Ograniczanie żądań po IP
- Ograniczanie po użytkowniku (przez JWT)

### CORS

Ustawienia CORS są zdefiniowane w każdym serwisie:

```typescript
app.enableCors({
  origin: ['http://localhost:4200'],
  credentials: true,
});
```

### Helmet

Nagłówki HTTP bezpieczeństwa przez middleware Helmet.

## TLS

### Lokalne środowisko

TLS nie jest używane w lokalnym środowisku (HTTP).

### Produkcja

Traefik zapewnia terminację TLS:

```yaml
# infrastructure/traefik/traefik.yml
entryPoints:
  websecure:
    address: ":443"
certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@yourdomain.com
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

## Bezpieczeństwo danych

### Bazy danych

- Każdy serwis ma izolowaną bazę danych (database-per-service)
- Połączenia SSL na produkcji
- Dane uwierzytelniające przechowywane w Kubernetes Secrets

### Sekrety

- Lokalnie: plik `.env` (nie commituj!)
- Kubernetes: zasoby `Secret`
- Zalecane: HashiCorp Vault lub AWS Secrets Manager

### Artefakty (MinIO)

- Dostęp przez pre-signed URLs z ograniczonym TTL
- Bucket policies do kontroli dostępu

## Zalecenia produkcyjne

1. **Zmień wszystkie sekrety** — JWT_SECRET, NEXTAUTH_SECRET, hasła baz danych
2. **Włącz TLS** — przez Traefik lub cloud load balancer
3. **Skonfiguruj CORS** — ogranicz dozwolone źródła
4. **Włącz rate limiting** — ochrona przed DDoS
5. **Skonfiguruj logi audytowe** — śledzenie działań użytkowników
6. **Aktualizuj zależności** — regularne poprawki bezpieczeństwa
7. **Użyj network policies** — ogranicz komunikację międzyserwisową
8. **Szyfruj dane** — szyfrowanie w spoczynku dla baz danych
