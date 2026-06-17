#!/usr/bin/env bash
set -e

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/mongo-backup-${TIMESTAMP}.archive"

# Source environment
if [ -f .env.production ]; then
  export $(grep -v '^#' .env.production | xargs)
fi

echo "Starting MongoDB backup..."
docker compose -f docker-compose.prod.yml --env-file .env.production exec mongodb bash -c 'mongodump --archive=/tmp/manager-point.archive --gzip --username="$MONGO_INITDB_ROOT_USERNAME" --password="$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase=admin'

MONGODB_CONTAINER=$(docker compose -f docker-compose.prod.yml ps -q mongodb)
docker cp ${MONGODB_CONTAINER}:/tmp/manager-point.archive "$BACKUP_FILE"

echo "Backup saved to $BACKUP_FILE"
