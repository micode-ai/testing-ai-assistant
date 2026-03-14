# Troubleshooting

## Installation Issues

### Docker Containers Won't Start

**Symptom:** `docker compose ps` shows containers in `restarting` or `exited` status.

**Solutions:**

1. Check if ports are already in use:
   ```bash
   netstat -tulpn | grep -E '(5441|5434|5437|5438|5439|5440|6380|19092)'
   ```

2. Check container logs:
   ```bash
   docker compose logs <container-name>
   ```

3. Full reset and restart:
   ```bash
   pnpm docker:reset
   ```

4. Ensure Docker has sufficient resources (minimum 8 GB RAM).

### pnpm install Fails

**Solutions:**

1. Ensure correct Node.js version (>= 20):
   ```bash
   node --version
   ```

2. Clear cache:
   ```bash
   pnpm store prune
   rm -rf node_modules
   pnpm install
   ```

### Database Migrations Fail

**Symptom:** `pnpm db:migrate` fails with connection error.

**Solutions:**

1. Ensure PostgreSQL containers are running and `healthy`:
   ```bash
   docker compose ps | grep postgres
   ```

2. Verify connection URL in `.env`:
   ```bash
   docker compose exec postgres-identity pg_isready
   ```

3. Wait 1-2 minutes after `docker:up` — databases may still be initializing.

## Startup Issues

### Service Won't Start

**Symptom:** Error during `pnpm dev`.

**Solutions:**

1. Ensure Prisma clients are generated:
   ```bash
   pnpm db:generate
   ```

2. Check `.env` — all required variables must be set.

3. Run specific service for detailed error:
   ```bash
   cd services/identity
   npm run dev
   ```

### Port Already in Use

**Symptom:** `EADDRINUSE: address already in use`.

**Solutions:**

1. Find process using the port:
   ```bash
   lsof -i :<port>    # macOS/Linux
   netstat -ano | findstr :<port>    # Windows
   ```

2. Kill the process or change the port in `.env`.

## Authentication Issues

### 401 Unauthorized

**Possible causes:**

1. **Access token expired** — refresh via `POST /auth/refresh`
2. **Token blacklisted** — log in again
3. **Wrong header format** — should be `Authorization: Bearer <token>`

### OAuth Not Working

**Solutions:**

1. Verify `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` in `.env`
2. Ensure callback URL in OAuth app settings matches
3. Check Identity Service logs

## Webhook Issues

### Webhook Not Created

**Possible causes:**

1. No admin permissions on the repository
2. OAuth token lacks required scopes
3. Application URL not reachable from the internet (use ngrok for local development)

### Webhook Not Triggering Pipeline

**Solutions:**

1. Check webhook status in the Git provider
2. Check Project Service logs
3. Ensure pipeline is active (`enabled: true`)

## AI Generation Issues

### AI Generation Hangs

**Solutions:**

1. Verify `OPENAI_API_KEY` in `.env`
2. Check AI Service logs:
   ```bash
   docker compose logs ai-service
   ```
3. Ensure OpenAI API quota is not exhausted

### Poor Generation Quality

**Solutions:**

1. Use a more powerful model: `OPENAI_MODEL_ADVANCED=o3`
2. Ensure the AI agent has access to project code
3. Provide feedback via `PATCH /ai/generations/:id/feedback`

## Test Run Issues

### Run Stuck in RUNNING Status

**Solutions:**

1. Check Temporal UI: http://localhost:8233
2. Check Test Runner logs
3. Cancel the run:
   ```bash
   curl -X POST http://localhost:3004/test-runs/<id>/cancel \
     -H "Authorization: Bearer <token>"
   ```

### Run Completed with ERROR

**Solutions:**

1. Check run logs in the detail view
2. Verify Temporal and MinIO are running
3. Ensure Git repository is accessible

## Notification Issues

### Email Not Sending

**Solutions:**

1. Check SMTP settings in `.env`
2. For Gmail — use an App Password, not your regular password
3. Check Notification Service logs

### Slack Notifications Not Arriving

**Solutions:**

1. Verify `SLACK_BOT_TOKEN`
2. Ensure bot is added to the target channel
3. Check bot scopes: need `chat:write`

## Performance Issues

### High Latency

**Solutions:**

1. Check metrics in Grafana
2. Verify databases aren't overloaded:
   ```bash
   docker stats
   ```
3. Increase Docker resources (RAM, CPU)

### Memory Leaks

**Solutions:**

1. Monitor consumption via `docker stats`
2. Check Node.js heap via traces
3. Restart the problematic service

## Useful Diagnostic Commands

```bash
# All container status
docker compose ps

# Specific service logs
docker compose logs -f <service-name>

# Resource consumption
docker stats

# Check DB connection
docker compose exec postgres-identity pg_isready

# Check Redis
docker compose exec redis redis-cli ping

# Check health endpoints
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
curl http://localhost:3006/health
```
