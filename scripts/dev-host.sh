#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_COMPOSE_FILE="${INFRA_COMPOSE_FILE:-docker-compose.dev-infra.yml}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for MongoDB and Redis." >&2
  exit 1
fi

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

export MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/manager-point}"
export REDIS_HOST="${REDIS_HOST:-localhost}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8001}"
export PORT="${PORT:-8001}"

cd "$ROOT_DIR"
docker compose -f "$INFRA_COMPOSE_FILE" up -d

echo "MongoDB and Redis are running in Docker."
echo "Starting backend at http://localhost:$PORT and frontend at http://localhost:3000..."

cleanup() {
  trap - INT TERM EXIT
  kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
  wait "$backend_pid" "$frontend_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

(cd "$ROOT_DIR/backend" && exec npm run start:dev) &
backend_pid=$!
(cd "$ROOT_DIR/frontend" && exec npm run dev) &
frontend_pid=$!

wait "$backend_pid" "$frontend_pid"
