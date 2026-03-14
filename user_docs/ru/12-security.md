# Безопасность

## Аутентификация

### JWT-токены

Система использует JWT для stateless-аутентификации:

- **Access Token** — короткоживущий (по умолчанию 1 час)
- **Refresh Token** — долгоживущий (по умолчанию 7 дней)

```env
JWT_SECRET=ваш-секретный-ключ     # Обязательно сменить в продакшене!
JWT_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d
```

### Процесс аутентификации

1. Пользователь отправляет логин/пароль на `POST /auth/login`
2. Сервер проверяет credentials и возвращает пару токенов
3. Клиент передаёт access token в заголовке `Authorization: Bearer <token>`
4. При истечении access token, клиент обновляет его через `POST /auth/refresh`
5. При выходе, refresh token добавляется в чёрный список (Redis)

### Чёрный список токенов

Отозванные токены хранятся в Redis с TTL, равным времени жизни токена. При каждом запросе проверяется, не находится ли токен в чёрном списке.

### OAuth2

Поддерживаемые провайдеры:

| Провайдер | Эндпоинт |
|-----------|---------|
| GitHub | `/auth/github`, `/auth/github/callback` |
| GitLab | `/auth/gitlab`, `/auth/gitlab/callback` |
| Bitbucket | `/auth/bitbucket`, `/auth/bitbucket/callback` |

Настройка:

```env
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITLAB_CLIENT_ID=...
GITLAB_CLIENT_SECRET=...
BITBUCKET_CLIENT_ID=...
BITBUCKET_CLIENT_SECRET=...
```

### Keycloak (опционально)

Для корпоративного SSO можно подключить Keycloak:

- Доступ: http://localhost:8180
- Identity Service синхронизирует пользователей с Keycloak
- Поддержка OIDC/SAML протоколов

## Авторизация

### RBAC (Role-Based Access Control)

Роли определяются на уровне организации:

| Роль | Права |
|------|-------|
| `ADMIN` | Полный доступ: управление участниками, настройки, удаление |
| `MEMBER` | Работа с проектами, пайплайнами, запуск тестов |
| `VIEWER` | Только чтение: просмотр проектов и результатов |

### Guards (NestJS)

Каждый эндпоинт защищён NestJS Guards:

- **JwtAuthGuard** — проверка JWT-токена
- **RolesGuard** — проверка роли пользователя
- **OrgMemberGuard** — проверка членства в организации

## Хранение паролей

- Пароли хешируются через `bcryptjs` с salt rounds = 10
- Оригинальные пароли нигде не хранятся
- При проверке используется `bcrypt.compare()`

## Безопасность API

### Валидация входных данных

Все входные данные валидируются через:

- `class-validator` — декораторы валидации на DTO
- `class-transformer` — трансформация и санитизация
- `zod` — схемная валидация (Dashboard)

### Rate Limiting

Traefik обеспечивает rate limiting на уровне API Gateway:

- Ограничение запросов по IP
- Ограничение по пользователю (через JWT)

### CORS

Настройки CORS определены в каждом сервисе:

```typescript
app.enableCors({
  origin: ['http://localhost:4200'],
  credentials: true,
});
```

### Helmet

HTTP-заголовки безопасности через middleware Helmet.

## TLS

### Локальная разработка

В локальной разработке TLS не используется (HTTP).

### Продакшен

Traefik обеспечивает TLS-терминацию:

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

## Безопасность данных

### Базы данных

- Каждый сервис имеет изолированную базу данных (database-per-service)
- Подключения через SSL в продакшене
- Учётные данные хранятся в Kubernetes Secrets

### Секреты

- Локально: `.env` файл (не коммитить!)
- Kubernetes: `Secret` ресурсы
- Рекомендуется: HashiCorp Vault или AWS Secrets Manager

### Артефакты (MinIO)

- Доступ через pre-signed URLs с ограниченным TTL
- Bucket policies для разграничения доступа

## Рекомендации для продакшена

1. **Смените все секреты** — JWT_SECRET, NEXTAUTH_SECRET, пароли БД
2. **Включите TLS** — через Traefik или cloud load balancer
3. **Настройте CORS** — ограничьте allowed origins
4. **Включите rate limiting** — защита от DDoS
5. **Настройте аудит-логи** — отслеживание действий пользователей
6. **Обновляйте зависимости** — регулярные security-патчи
7. **Используйте network policies** — ограничьте межсервисное взаимодействие
8. **Шифруйте данные** — encryption at rest для баз данных
