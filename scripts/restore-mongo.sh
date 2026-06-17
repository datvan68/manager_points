#!/usr/bin/env bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-backup-file>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file $BACKUP_FILE not found!"
  exit 1
fi

# Source environment
if [ -f .env.production ]; then
  export $(grep -v '^#' .env.production | xargs)
fi

echo "Restoring MongoDB from $BACKUP_FILE..."

MONGODB_CONTAINER=$(docker compose -f docker-compose.prod.yml ps -q mongodb)
docker cp "$BACKUP_FILE" ${MONGODB_CONTAINER}:/tmp/restore.archive

docker compose -f docker-compose.prod.yml --env-file .env.production exec mongodb bash -c 'mongorestore --archive=/tmp/restore.archive --gzip --drop --username="$MONGO_INITDB_ROOT_USERNAME" --password="$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase=admin'

echo "Restore complete!"
