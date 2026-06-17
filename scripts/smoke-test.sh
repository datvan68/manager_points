#!/usr/bin/env bash
set -e

echo "Smoke testing backend health..."
curl -f http://localhost:8000/health || (echo "Backend health check failed!" && exit 1)

echo "Smoke testing frontend home page..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep "200" || (echo "Frontend home page failed!" && exit 1)

echo "All smoke tests passed!"
