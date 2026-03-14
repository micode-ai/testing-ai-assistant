#!/bin/bash
set -euo pipefail

# =============================================================================
# Seed Development Data
# =============================================================================
# Creates test data for local development via API calls.
# Requires the dev environment to be running (./infrastructure/scripts/setup-dev.sh)
# Usage: ./infrastructure/scripts/seed-dev.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Service URLs (defaults for local development)
IDENTITY_URL="${IDENTITY_URL:-http://localhost:3001}"
ORGANIZATION_URL="${ORGANIZATION_URL:-http://localhost:3002}"
PROJECT_URL="${PROJECT_URL:-http://localhost:3003}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check that services are running
check_services() {
  log_info "Checking that services are running..."

  local services_ok=true

  if ! curl -sf "${IDENTITY_URL}/health" >/dev/null 2>&1; then
    log_error "Identity service is not reachable at ${IDENTITY_URL}"
    services_ok=false
  fi

  if ! curl -sf "${ORGANIZATION_URL}/health" >/dev/null 2>&1; then
    log_error "Organization service is not reachable at ${ORGANIZATION_URL}"
    services_ok=false
  fi

  if ! curl -sf "${PROJECT_URL}/health" >/dev/null 2>&1; then
    log_error "Project service is not reachable at ${PROJECT_URL}"
    services_ok=false
  fi

  if [ "$services_ok" = false ]; then
    echo ""
    log_error "Some services are not running. Start them first:"
    echo "  pnpm dev"
    exit 1
  fi

  log_info "All services are reachable."
}

# Create a test user and capture the auth token
create_test_user() {
  log_info "Creating test user..."

  local response
  response=$(curl -sf -X POST "${IDENTITY_URL}/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "dev@testing-ai.local",
      "password": "DevPassword123!",
      "firstName": "Dev",
      "lastName": "User"
    }' 2>&1) || {
    log_warn "Test user may already exist, attempting login..."
    response=$(curl -sf -X POST "${IDENTITY_URL}/api/auth/login" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "dev@testing-ai.local",
        "password": "DevPassword123!"
      }' 2>&1) || {
      log_error "Failed to create or login as test user."
      exit 1
    }
  }

  AUTH_TOKEN=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")

  if [ -z "$AUTH_TOKEN" ]; then
    log_warn "Could not extract auth token. Some seed operations may fail."
  else
    log_info "Test user authenticated successfully."
  fi
}

# Create a test organization
create_test_organization() {
  log_info "Creating test organization..."

  local response
  response=$(curl -sf -X POST "${ORGANIZATION_URL}/api/organizations" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -d '{
      "name": "Test Organization",
      "slug": "test-org",
      "description": "Default development organization"
    }' 2>&1) || {
    log_warn "Test organization may already exist, skipping."
    return 0
  }

  ORG_ID=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
  log_info "Test organization created${ORG_ID:+ (ID: $ORG_ID)}."
}

# Create a test project
create_test_project() {
  log_info "Creating test project..."

  local response
  response=$(curl -sf -X POST "${PROJECT_URL}/api/projects" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    -d "{
      \"name\": \"Sample Project\",
      \"slug\": \"sample-project\",
      \"description\": \"Default development project for testing\",
      \"organizationId\": \"${ORG_ID:-}\"
    }" 2>&1) || {
    log_warn "Test project may already exist, skipping."
    return 0
  }

  local project_id
  project_id=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
  log_info "Test project created${project_id:+ (ID: $project_id)}."
}

# Create sample test suites
create_test_suites() {
  log_info "Creating sample test suites..."

  local suites=(
    '{"name": "Smoke Tests", "description": "Basic smoke tests for core functionality"}'
    '{"name": "Regression Suite", "description": "Full regression test suite"}'
    '{"name": "API Tests", "description": "API endpoint validation tests"}'
  )

  for suite in "${suites[@]}"; do
    curl -sf -X POST "${PROJECT_URL}/api/test-suites" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${AUTH_TOKEN}" \
      -d "$suite" >/dev/null 2>&1 || log_warn "Could not create test suite, skipping."
  done

  log_info "Sample test suites created."
}

# Main
main() {
  echo "==========================================="
  echo "  Testing AI Assistant - Seed Dev Data"
  echo "==========================================="
  echo ""

  AUTH_TOKEN=""
  ORG_ID=""

  check_services
  create_test_user
  create_test_organization
  create_test_project
  create_test_suites

  echo ""
  echo "==========================================="
  log_info "Development data seeded successfully!"
  echo "==========================================="
  echo ""
  echo "Test credentials:"
  echo "  Email:    dev@testing-ai.local"
  echo "  Password: DevPassword123!"
  echo ""
}

main "$@"
