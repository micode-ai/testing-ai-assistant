#!/bin/bash
set -euo pipefail

# =============================================================================
# Development Environment Setup
# =============================================================================
# Sets up a local development environment with all required services.
# Usage: ./infrastructure/scripts/setup-dev.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."

  local missing=()

  if ! command -v node &>/dev/null; then
    missing+=("node")
  fi

  if ! command -v pnpm &>/dev/null; then
    missing+=("pnpm")
  fi

  if ! command -v docker &>/dev/null; then
    missing+=("docker")
  fi

  if [ ${#missing[@]} -gt 0 ]; then
    log_error "Missing required tools: ${missing[*]}"
    echo "Please install the following before running this script:"
    for tool in "${missing[@]}"; do
      case $tool in
        node) echo "  - Node.js 20+: https://nodejs.org/" ;;
        pnpm) echo "  - pnpm: npm install -g pnpm" ;;
        docker) echo "  - Docker: https://docs.docker.com/get-docker/" ;;
      esac
    done
    exit 1
  fi

  log_info "All prerequisites found."
}

# Install project dependencies
install_dependencies() {
  log_info "Installing project dependencies..."
  cd "$PROJECT_ROOT"
  pnpm install
  log_info "Dependencies installed."
}

# Start infrastructure services via Docker Compose
start_services() {
  log_info "Starting infrastructure services (PostgreSQL, Redis, etc.)..."
  cd "$PROJECT_ROOT"
  docker compose up -d

  log_info "Waiting for services to be healthy..."
  local retries=30
  local wait_seconds=2

  # Wait for PostgreSQL
  for i in $(seq 1 $retries); do
    if docker compose exec -T postgres pg_isready -U postgres &>/dev/null; then
      log_info "PostgreSQL is ready."
      break
    fi
    if [ "$i" -eq "$retries" ]; then
      log_error "PostgreSQL failed to start within $((retries * wait_seconds)) seconds."
      exit 1
    fi
    sleep $wait_seconds
  done

  # Wait for Redis
  for i in $(seq 1 $retries); do
    if docker compose exec -T redis redis-cli ping &>/dev/null; then
      log_info "Redis is ready."
      break
    fi
    if [ "$i" -eq "$retries" ]; then
      log_error "Redis failed to start within $((retries * wait_seconds)) seconds."
      exit 1
    fi
    sleep $wait_seconds
  done
}

# Generate Prisma clients and run migrations
setup_database() {
  log_info "Generating Prisma clients..."
  cd "$PROJECT_ROOT"
  pnpm turbo prisma:generate

  log_info "Running database migrations..."
  pnpm turbo prisma:migrate

  log_info "Database setup complete."
}

# Create .env files if they don't exist
setup_env_files() {
  log_info "Setting up environment files..."
  cd "$PROJECT_ROOT"

  if [ -f .env.example ] && [ ! -f .env ]; then
    cp .env.example .env
    log_info "Created .env from .env.example"
  fi

  # Set up service-level .env files
  for service_dir in apps/*/; do
    if [ -f "${service_dir}.env.example" ] && [ ! -f "${service_dir}.env" ]; then
      cp "${service_dir}.env.example" "${service_dir}.env"
      log_info "Created ${service_dir}.env from .env.example"
    fi
  done
}

# Main
main() {
  echo "==========================================="
  echo "  Testing AI Assistant - Dev Setup"
  echo "==========================================="
  echo ""

  check_prerequisites
  setup_env_files
  install_dependencies
  start_services
  setup_database

  echo ""
  echo "==========================================="
  log_info "Dev environment is ready!"
  echo "==========================================="
  echo ""
  echo "Available commands:"
  echo "  pnpm dev              - Start all services in dev mode"
  echo "  pnpm turbo test       - Run all tests"
  echo "  pnpm turbo lint       - Run linting"
  echo "  pnpm turbo build      - Build all packages"
  echo ""
  echo "Infrastructure:"
  echo "  PostgreSQL: localhost:5432"
  echo "  Redis:      localhost:6379"
  echo ""
}

main "$@"
