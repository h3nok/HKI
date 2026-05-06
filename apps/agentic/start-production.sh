#!/bin/bash
set -euo pipefail

export NODE_ENV=production
export PORT="${PORT:-9001}"

echo "Starting Agentic BFF in production mode on port $PORT..."

# Graceful shutdown: forward SIGTERM to Node process
trap 'echo "Shutting down..."; kill -TERM "$PID"; wait "$PID"' SIGTERM SIGINT

node dist/index.js &
PID=$!
wait "$PID"
