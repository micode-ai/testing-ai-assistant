#!/usr/bin/env bash
# ===========================================================================
# Seed development secrets into HashiCorp Vault (KV v2)
# ---------------------------------------------------------------------------
# Usage:
#   export VAULT_ADDR=http://127.0.0.1:8200
#   export VAULT_TOKEN=<root-token>
#   ./seed-secrets.sh
#
# WARNING: This script is for LOCAL DEVELOPMENT ONLY.
#          Never run against staging or production Vault instances.
# ===========================================================================

set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
PROJECT="testing-ai"

echo "==> Vault address: ${VAULT_ADDR}"
echo "==> Seeding development secrets..."

# ---------------------------------------------------------------------------
# Enable KV v2 secrets engine (idempotent)
# ---------------------------------------------------------------------------
vault secrets enable -path=secret -version=2 kv 2>/dev/null || true

# ---------------------------------------------------------------------------
# Write policy
# ---------------------------------------------------------------------------
vault policy write services-policy /vault/policies/services.hcl 2>/dev/null || \
  vault policy write services-policy ./policies/services.hcl

# ---------------------------------------------------------------------------
# Shared secrets
# ---------------------------------------------------------------------------
echo "  -> shared secrets"
vault kv put "secret/${PROJECT}/shared/database" \
  host="localhost" \
  port="5432" \
  ssl_mode="disable"

vault kv put "secret/${PROJECT}/shared/redis" \
  host="localhost" \
  port="6379" \
  password="redis-dev-password" \
  tls_enabled="false"

vault kv put "secret/${PROJECT}/shared/nats" \
  url="nats://localhost:4222" \
  cluster_id="testing-ai-dev"

vault kv put "secret/${PROJECT}/shared/jwt" \
  access_secret="dev-access-secret-change-in-production-$(openssl rand -hex 16)" \
  refresh_secret="dev-refresh-secret-change-in-production-$(openssl rand -hex 16)" \
  access_ttl="15m" \
  refresh_ttl="7d"

# ---------------------------------------------------------------------------
# Identity Service
# ---------------------------------------------------------------------------
echo "  -> identity-service"
vault kv put "secret/${PROJECT}/identity/database" \
  name="identity_db" \
  username="identity_admin" \
  password="identity-dev-password-$(openssl rand -hex 8)"

vault kv put "secret/${PROJECT}/identity/oauth" \
  google_client_id="google-client-id-placeholder" \
  google_client_secret="google-client-secret-placeholder" \
  github_client_id="github-client-id-placeholder" \
  github_client_secret="github-client-secret-placeholder"

# ---------------------------------------------------------------------------
# Organization Service
# ---------------------------------------------------------------------------
echo "  -> organization-service"
vault kv put "secret/${PROJECT}/organization/database" \
  name="organization_db" \
  username="organization_admin" \
  password="organization-dev-password-$(openssl rand -hex 8)"

# ---------------------------------------------------------------------------
# Project Service
# ---------------------------------------------------------------------------
echo "  -> project-service"
vault kv put "secret/${PROJECT}/project/database" \
  name="project_db" \
  username="project_admin" \
  password="project-dev-password-$(openssl rand -hex 8)"

vault kv put "secret/${PROJECT}/project/storage" \
  s3_bucket="testing-ai-dev-artifacts" \
  s3_region="us-east-1" \
  s3_access_key="AKIAIOSFODNN7EXAMPLE" \
  s3_secret_key="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

# ---------------------------------------------------------------------------
# Pipeline Service
# ---------------------------------------------------------------------------
echo "  -> pipeline-service"
vault kv put "secret/${PROJECT}/pipeline/database" \
  name="pipeline_db" \
  username="pipeline_admin" \
  password="pipeline-dev-password-$(openssl rand -hex 8)"

vault kv put "secret/${PROJECT}/pipeline/browser" \
  pool_size="5" \
  timeout_ms="30000" \
  chrome_flags="--no-sandbox,--disable-gpu,--disable-dev-shm-usage"

# ---------------------------------------------------------------------------
# AI Service
# ---------------------------------------------------------------------------
echo "  -> ai-service"
vault kv put "secret/${PROJECT}/ai/providers" \
  openai_api_key="sk-placeholder-replace-with-real-key" \
  openai_org_id="org-placeholder" \
  anthropic_api_key="sk-ant-placeholder-replace-with-real-key"

vault kv put "secret/${PROJECT}/ai/database" \
  name="ai_db" \
  username="ai_admin" \
  password="ai-dev-password-$(openssl rand -hex 8)"

# ---------------------------------------------------------------------------
# Notification Service
# ---------------------------------------------------------------------------
echo "  -> notification-service"
vault kv put "secret/${PROJECT}/notification/database" \
  name="notification_db" \
  username="notification_admin" \
  password="notification-dev-password-$(openssl rand -hex 8)"

vault kv put "secret/${PROJECT}/notification/email" \
  smtp_host="localhost" \
  smtp_port="1025" \
  smtp_username="" \
  smtp_password="" \
  from_address="noreply@testing-ai.example.com"

vault kv put "secret/${PROJECT}/notification/slack" \
  webhook_url="https://hooks.slack.com/services/PLACEHOLDER" \
  bot_token="xoxb-placeholder-token"

# ---------------------------------------------------------------------------
# Enable Kubernetes auth (for cluster deployments)
# ---------------------------------------------------------------------------
echo "  -> configuring Kubernetes auth method (will fail outside of cluster)"
vault auth enable kubernetes 2>/dev/null || true

# Create roles for each service
for SERVICE in identity organization project pipeline ai notification; do
  vault write "auth/kubernetes/role/${SERVICE}-service" \
    bound_service_account_names="${SERVICE}-service" \
    bound_service_account_namespaces="${PROJECT}" \
    policies="services-policy" \
    ttl="1h" 2>/dev/null || echo "    (skipped k8s role for ${SERVICE}-service – not in cluster)"
done

echo ""
echo "==> Development secrets seeded successfully!"
echo "    Access them with: vault kv get secret/${PROJECT}/<service>/<key>"
