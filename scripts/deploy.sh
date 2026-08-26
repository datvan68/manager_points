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

if [ ! -f "$ENV_FILE" ]; then
  echo "$ENV_FILE not found! Please create it on the production server."
  exit 1
fi

REGISTRY="${REGISTRY:-$(read_env_value REGISTRY)}"
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-$(read_env_value NEXT_PUBLIC_API_URL)}"
APP_VERSION="${APP_VERSION:-$(read_env_value APP_VERSION)}"
MONGO_ROOT_USERNAME="${MONGO_ROOT_USERNAME:-$(read_env_value MONGO_INITDB_ROOT_USERNAME)}"
MONGO_ROOT_PASSWORD="${MONGO_ROOT_PASSWORD:-$(read_env_value MONGO_INITDB_ROOT_PASSWORD)}"

: "${REGISTRY:?REGISTRY must be set in $ENV_FILE}"
: "${NEXT_PUBLIC_API_URL:?NEXT_PUBLIC_API_URL must be set in $ENV_FILE}"

if [ -z "${APP_VERSION:-}" ]; then
  APP_VERSION="$(git rev-parse --short HEAD)"
fi
export APP_VERSION REGISTRY NEXT_PUBLIC_API_URL MONGO_ROOT_USERNAME MONGO_ROOT_PASSWORD

echo "Building images with version $APP_VERSION..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build backend frontend

if [ "${PUSH_IMAGES:-true}" = "true" ]; then
  echo "Pushing application images..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" push backend frontend
fi

echo "Pulling the approved application images..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull backend frontend

echo "Deploying..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d \
  --remove-orphans \
  mongodb redis

COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" MONGO_ROOT_USERNAME="$MONGO_ROOT_USERNAME" MONGO_ROOT_PASSWORD="$MONGO_ROOT_PASSWORD" MONGO_WAIT_TIMEOUT="${DEPLOY_WAIT_TIMEOUT:-180}" \
  bash ./scripts/ensure-mongo-replica-set.sh

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d \
  --remove-orphans \
  --wait \
  --wait-timeout "${DEPLOY_WAIT_TIMEOUT:-180}"

echo "Running post-deploy smoke tests..."
COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" ./scripts/smoke-test.sh

echo "Application container memory after deployment:"
APP_CONTAINER_IDS="$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q frontend backend)"
if [ -n "$APP_CONTAINER_IDS" ]; then
  # shellcheck disable=SC2086
  docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}' $APP_CONTAINER_IDS
fi

if [ "${PRUNE_DANGLING_IMAGES:-false}" = "true" ]; then
  echo "Removing dangling images left by successful builds..."
  docker image prune --force --filter "dangling=true"
fi

echo "Done!"
