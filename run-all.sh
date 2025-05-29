#!/bin/bash

set -e

# Daftar path ke docker-compose.yml
COMPOSE_PATHS=(
  "./api-gateway"
  "./chat"
  "./kulkasku"
  "./profile"
)

for path in "${COMPOSE_PATHS[@]}"; do
  echo "🚀 Starting services in $path"
  docker-compose -f "$path/docker-compose.yml" up -d --build
done

echo "✅ All services started successfully!"
