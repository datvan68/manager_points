#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/mongo-backup-${TIMESTAMP}.archive.gz"

if [ ! -f "$ENV_FILE" ]; then
  echo "$ENV_FILE not found! Please create it on the production server."
  exit 1
fi

echo "Starting MongoDB backup..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T mongodb sh -c \
  'mongodump --archive=/tmp/manager-point.archive.gz --gzip --username="$MONGO_INITDB_ROOT_USERNAME" --password="$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase=admin'

MONGODB_CONTAINER="$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q mongodb)"
docker cp "${MONGODB_CONTAINER}:/tmp/manager-point.archive.gz" "$BACKUP_FILE"

echo "Backup saved to $BACKUP_FILE"
