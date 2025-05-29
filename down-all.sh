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
  echo "🛑 Stopping services in $path"
  docker-compose -f "$path/docker-compose.yml" down
done

echo "🧹 All services stopped and cleaned up!"
