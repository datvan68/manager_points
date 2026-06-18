#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-backup-file>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file $BACKUP_FILE not found!"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "$ENV_FILE not found! Please create it on the production server."
  exit 1
fi

if [ "${CONFIRM_PRODUCTION_RESTORE:-}" != "yes" ]; then
  echo "Refusing to restore without explicit confirmation."
  echo "Re-run with CONFIRM_PRODUCTION_RESTORE=yes after human approval."
  exit 1
fi

echo "Restoring MongoDB from $BACKUP_FILE..."

MONGODB_CONTAINER="$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q mongodb)"
docker cp "$BACKUP_FILE" "${MONGODB_CONTAINER}:/tmp/restore.archive.gz"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T mongodb sh -c \
  'mongorestore --archive=/tmp/restore.archive.gz --gzip --drop --username="$MONGO_INITDB_ROOT_USERNAME" --password="$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase=admin'

echo "Restore complete!"
