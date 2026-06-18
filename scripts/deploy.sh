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

: "${REGISTRY:?REGISTRY must be set in $ENV_FILE}"
: "${NEXT_PUBLIC_API_URL:?NEXT_PUBLIC_API_URL must be set in $ENV_FILE}"

if [ -z "${APP_VERSION:-}" ]; then
  APP_VERSION="$(git rev-parse --short HEAD)"
fi
export APP_VERSION REGISTRY NEXT_PUBLIC_API_URL

echo "Building images with version $APP_VERSION..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build backend frontend

if [ "${PUSH_IMAGES:-true}" = "true" ]; then
  echo "Pushing application images..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" push backend frontend
fi

echo "Pulling the approved application images..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull backend frontend

echo "Deploying..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo "Done!"
