#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Cloud Run production verification is retired."
echo "Running canonical GKE verification via scripts/test-k8s-e2e.sh."

exec "${ROOT_DIR}/scripts/test-k8s-e2e.sh" "$@"
