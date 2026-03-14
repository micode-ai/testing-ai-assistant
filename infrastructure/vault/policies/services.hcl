# ===========================================================================
# Vault Policy – Service Access to Secrets
# ===========================================================================
# This policy grants micro-services read access to their scoped secrets
# under the KV v2 secrets engine.

# ---------------------------------------------------------------------------
# Shared secrets (database connection strings, Redis, message broker, etc.)
# ---------------------------------------------------------------------------
path "secret/data/testing-ai/shared/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/testing-ai/shared/*" {
  capabilities = ["list"]
}

# ---------------------------------------------------------------------------
# Identity Service
# ---------------------------------------------------------------------------
path "secret/data/testing-ai/identity/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/testing-ai/identity/*" {
  capabilities = ["list"]
}

# ---------------------------------------------------------------------------
# Organization Service
# ---------------------------------------------------------------------------
path "secret/data/testing-ai/organization/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/testing-ai/organization/*" {
  capabilities = ["list"]
}

# ---------------------------------------------------------------------------
# Project Service
# ---------------------------------------------------------------------------
path "secret/data/testing-ai/project/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/testing-ai/project/*" {
  capabilities = ["list"]
}

# ---------------------------------------------------------------------------
# Pipeline Service
# ---------------------------------------------------------------------------
path "secret/data/testing-ai/pipeline/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/testing-ai/pipeline/*" {
  capabilities = ["list"]
}

# ---------------------------------------------------------------------------
# AI Service
# ---------------------------------------------------------------------------
path "secret/data/testing-ai/ai/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/testing-ai/ai/*" {
  capabilities = ["list"]
}

# ---------------------------------------------------------------------------
# Notification Service
# ---------------------------------------------------------------------------
path "secret/data/testing-ai/notification/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/testing-ai/notification/*" {
  capabilities = ["list"]
}

# ---------------------------------------------------------------------------
# Per-service scoped policies (for fine-grained Kubernetes auth)
# Each service should use its own Vault role mapped to one of these policies.
# ---------------------------------------------------------------------------

# Example: identity-service role gets only shared + identity paths
# vault write auth/kubernetes/role/identity-service \
#   bound_service_account_names=identity-service \
#   bound_service_account_namespaces=testing-ai \
#   policies=identity-service-policy \
#   ttl=1h

# ---------------------------------------------------------------------------
# Token self-management (required for all service tokens)
# ---------------------------------------------------------------------------
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "sys/leases/renew" {
  capabilities = ["update"]
}
