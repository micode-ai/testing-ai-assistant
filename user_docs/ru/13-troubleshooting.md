# Устранение неполадок

## Проблемы при установке

### Docker-контейнеры не запускаются

**Симптом:** `docker compose ps` показывает контейнеры в статусе `restarting` или `exited`.

**Решения:**

1. Проверьте, что порты не заняты:
   ```bash
   # Проверка занятых портов
   netstat -tulpn | grep -E '(5441|5434|5437|5438|5439|5440|6380|19092)'
   ```

2. Проверьте логи контейнера:
   ```bash
   docker compose logs <container-name>
   ```

3. Полный сброс и перезапуск:
   ```bash
   pnpm docker:reset
   ```

4. Убедитесь, что Docker имеет достаточно ресурсов (минимум 8 ГБ RAM).

### pnpm install завершается с ошибкой

**Решения:**

1. Убедитесь, что используется правильная версия Node.js (>= 20):
   ```bash
   node --version
   ```

2. Очистите кэш:
   ```bash
   pnpm store prune
   rm -rf node_modules
   pnpm install
   ```

### Миграции БД не выполняются

**Симптом:** `pnpm db:migrate` завершается с ошибкой подключения.

**Решения:**

1. Убедитесь, что контейнеры PostgreSQL запущены и в статусе `healthy`:
   ```bash
   docker compose ps | grep postgres
   ```

2. Проверьте URL подключения в `.env`:
   ```bash
   # Должно быть доступно
   docker compose exec postgres-identity pg_isready
   ```

3. Подождите 1-2 минуты после `docker:up` — БД может ещё инициализироваться.

## Проблемы при запуске

### Сервис не запускается

**Симптом:** ошибка при `pnpm dev`.

**Решения:**

1. Убедитесь, что клиенты Prisma сгенерированы:
   ```bash
   pnpm db:generate
   ```

2. Проверьте `.env` — все обязательные переменные должны быть заполнены.

3. Запустите конкретный сервис для детальной ошибки:
   ```bash
   cd services/identity
   npm run dev
   ```

### Порт уже занят

**Симптом:** `EADDRINUSE: address already in use`.

**Решения:**

1. Найдите процесс, занимающий порт:
   ```bash
   lsof -i :<port>    # macOS/Linux
   netstat -ano | findstr :<port>    # Windows
   ```

2. Завершите процесс или измените порт в `.env`.

## Проблемы с аутентификацией

### 401 Unauthorized

**Возможные причины:**

1. **Истёк access token** — обновите через `POST /auth/refresh`
2. **Токен в чёрном списке** — войдите заново
3. **Неверный формат заголовка** — должен быть `Authorization: Bearer <token>`

### OAuth не работает

**Решения:**

1. Проверьте `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` в `.env`
2. Убедитесь, что callback URL в настройках OAuth-приложения совпадает
3. Проверьте логи Identity Service

## Проблемы с вебхуками

### Вебхук не создаётся

**Возможные причины:**

1. Нет прав администратора в репозитории
2. OAuth-токен не имеет нужных scopes
3. URL приложения недоступен из интернета (для локальной разработки используйте ngrok)

### Вебхук не триггерит пайплайн

**Решения:**

1. Проверьте статус вебхука в Git-провайдере
2. Проверьте логи Project Service
3. Убедитесь, что пайплайн активен (`enabled: true`)

## Проблемы с AI-генерацией

### AI-генерация зависает

**Решения:**

1. Проверьте `OPENAI_API_KEY` в `.env`
2. Проверьте логи AI Service:
   ```bash
   docker compose logs ai-service
   ```
3. Убедитесь, что квота OpenAI API не исчерпана

### Некачественные результаты генерации

**Решения:**

1. Используйте более мощную модель: `OPENAI_MODEL_ADVANCED=o3`
2. Обеспечьте AI-агенту доступ к коду проекта
3. Оставляйте обратную связь через `PATCH /ai/generations/:id/feedback`

## Проблемы с тестовыми прогонами

### Прогон завис в статусе RUNNING

**Решения:**

1. Проверьте Temporal UI: http://localhost:8233
2. Проверьте логи Test Runner
3. Отмените прогон:
   ```bash
   curl -X POST http://localhost:3004/test-runs/<id>/cancel \
     -H "Authorization: Bearer <token>"
   ```

### Прогон завершился с ERROR

**Решения:**

1. Проверьте логи прогона в детальном представлении
2. Проверьте, что Temporal и MinIO работают
3. Убедитесь, что Git-репозиторий доступен

## Проблемы с уведомлениями

### Email не отправляется

**Решения:**

1. Проверьте SMTP-настройки в `.env`
2. Для Gmail — используйте App Password, а не обычный пароль
3. Проверьте логи Notification Service

### Slack-уведомления не приходят

**Решения:**

1. Проверьте `SLACK_BOT_TOKEN`
2. Убедитесь, что бот добавлен в нужный канал
3. Проверьте scopes бота: нужен `chat:write`

## Проблемы с производительностью

### Высокая латентность

**Решения:**

1. Проверьте метрики в Grafana
2. Проверьте, не перегружены ли БД:
   ```bash
   docker stats
   ```
3. Увеличьте ресурсы Docker (RAM, CPU)

### Утечка памяти

**Решения:**

1. Мониторьте потребление через `docker stats`
2. Проверьте Node.js heap через трейсы
3. Перезапустите проблемный сервис

## Полезные диагностические команды

```bash
# Статус всех контейнеров
docker compose ps

# Логи конкретного сервиса
docker compose logs -f <service-name>

# Потребление ресурсов
docker stats

# Проверка подключения к БД
docker compose exec postgres-identity pg_isready

# Проверка Redis
docker compose exec redis redis-cli ping

# Проверка health-эндпоинтов
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
curl http://localhost:3006/health
```
