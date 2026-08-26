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

MONGO_ROOT_USERNAME="${MONGO_ROOT_USERNAME:-$(read_env_value MONGO_INITDB_ROOT_USERNAME)}"
MONGO_ROOT_PASSWORD="${MONGO_ROOT_PASSWORD:-$(read_env_value MONGO_INITDB_ROOT_PASSWORD)}"
MONGOSH_AUTH_ARGS=()
if [ -n "$MONGO_ROOT_USERNAME" ] && [ -n "$MONGO_ROOT_PASSWORD" ]; then
  MONGOSH_AUTH_ARGS+=(--username "$MONGO_ROOT_USERNAME" --password "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin)
fi

PUBLIC_URL="${SMOKE_PUBLIC_URL:-${FRONTEND_URL:-http://localhost}}"
PUBLIC_URL="${PUBLIC_URL%/}"

echo "Smoke testing MongoDB replica-set primary and rollback transaction..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T mongodb \
  mongosh --quiet "${MONGOSH_AUTH_ARGS[@]}" --eval 'const h=db.adminCommand({hello:1}); if(h.setName !== "rs0" || !h.isWritablePrimary) quit(1); const s=db.getMongo().startSession(); s.startTransaction(); s.getDatabase("manager-point").getCollection("_transaction_probe").insertOne({probe:true}); s.abortTransaction(); s.endSession();'

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
