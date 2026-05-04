#!/bin/bash
# Thin wrapper around the typed migration status command.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENTIC_DIR="${SCRIPT_DIR}/../agentic"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required."
  echo "Example: DATABASE_URL=mysql://root:root@localhost:9306/retail_agentic $0"
  exit 1
fi

cd "$AGENTIC_DIR"
pnpm db:migrate:status
