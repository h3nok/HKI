#!/bin/bash

set -euo pipefail

if [[ $# -lt 5 ]]; then
  echo "Usage: $0 <service-name> <dockerfile> <context-dir> <registry> <release-tag>" >&2
  exit 1
fi

SERVICE_NAME="$1"
DOCKERFILE="$2"
CONTEXT_DIR="$3"
REGISTRY="$4"
RELEASE_TAG="$5"

IMAGE_REPO="${REGISTRY}/${SERVICE_NAME}"
RELEASE_IMAGE="${IMAGE_REPO}:${RELEASE_TAG}"
LATEST_IMAGE="${IMAGE_REPO}:latest"

echo "  Building ${SERVICE_NAME} image: ${RELEASE_IMAGE}" >&2
docker build --no-cache --platform linux/amd64 \
  -f "${DOCKERFILE}" \
  -t "${RELEASE_IMAGE}" \
  "${CONTEXT_DIR}" >&2

echo "  Tagging ${SERVICE_NAME} image as ${LATEST_IMAGE}" >&2
docker tag "${RELEASE_IMAGE}" "${LATEST_IMAGE}" >&2

echo "  Pushing ${RELEASE_IMAGE}" >&2
docker push "${RELEASE_IMAGE}" >&2

echo "  Refreshing ${LATEST_IMAGE}" >&2
docker push "${LATEST_IMAGE}" >&2

IMAGE_REF="$(docker image inspect "${RELEASE_IMAGE}" --format '{{index .RepoDigests 0}}')"
if [[ -z "${IMAGE_REF}" ]]; then
  echo "Failed to resolve immutable digest for ${RELEASE_IMAGE}" >&2
  exit 1
fi

echo "  Immutable image ref: ${IMAGE_REF}" >&2
printf '%s\n' "${IMAGE_REF}"
