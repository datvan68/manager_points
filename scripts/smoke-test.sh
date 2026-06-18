#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

read_env_value() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

if [ -f "$ENV_FILE" ]; then
  FRONTEND_URL="${FRONTEND_URL:-$(read_env_value FRONTEND_URL)}"
fi

PUBLIC_URL="${SMOKE_PUBLIC_URL:-${FRONTEND_URL:-http://localhost}}"
PUBLIC_URL="${PUBLIC_URL%/}"

echo "Smoke testing backend health..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T backend \
  wget --no-verbose --tries=1 --spider http://127.0.0.1:8000/health

echo "Smoke testing frontend container..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T frontend \
  wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/

echo "Smoke testing public Caddy routes..."
curl -fsS -o /dev/null "$PUBLIC_URL/"
curl -fsS -o /dev/null "$PUBLIC_URL/health"

echo "All smoke tests passed!"
