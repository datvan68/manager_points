#!/usr/bin/env bash
set -e

# Load environment variables
if [ -f .env.production ]; then
  export $(grep -v '^#' .env.production | xargs)
else
  echo ".env.production not found! Please create it."
  exit 1
fi

APP_VERSION=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
export APP_VERSION

echo "Building images with version $APP_VERSION..."

# Build backend
docker build -t ${REGISTRY}/backend:${APP_VERSION} ./backend

# Build frontend with NEXT_PUBLIC_API_URL
docker build --build-arg NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} -t ${REGISTRY}/frontend:${APP_VERSION} ./frontend

echo "Deploying..."
docker compose -f docker-compose.prod.yml --env-file .env.production pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

echo "Done!"
