# ===========================================================================
# HashiCorp Vault Server Configuration
# ===========================================================================

# ---------------------------------------------------------------------------
# Storage Backend
# ---------------------------------------------------------------------------

# File backend (development / single-node)
storage "file" {
  path = "/vault/data"
}

# Consul backend (production – uncomment and replace file backend)
# storage "consul" {
#   address      = "consul.service.consul:8500"
#   path         = "vault/"
#   scheme       = "https"
#   token        = "CONSUL_ACL_TOKEN"
#   tls_ca_file  = "/vault/tls/consul-ca.pem"
#   tls_cert_file = "/vault/tls/consul-cert.pem"
#   tls_key_file  = "/vault/tls/consul-key.pem"
# }

# ---------------------------------------------------------------------------
# Listener
# ---------------------------------------------------------------------------

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = true  # Set to false in production and provide TLS certs

  # Production TLS settings (uncomment when tls_disable = false):
  # tls_cert_file = "/vault/tls/vault-cert.pem"
  # tls_key_file  = "/vault/tls/vault-key.pem"
  # tls_min_version = "tls12"
}

# ---------------------------------------------------------------------------
# General
# ---------------------------------------------------------------------------

api_addr     = "http://127.0.0.1:8200"
cluster_addr = "https://127.0.0.1:8201"

ui = true

# Disable mlock in containers (set to false in production bare-metal)
disable_mlock = true

# Telemetry
telemetry {
  prometheus_retention_time = "24h"
  disable_hostname          = true
}

# Max lease TTL
max_lease_ttl = "768h"

default_lease_ttl = "168h"

# Logging
log_level = "info"
log_format = "json"
