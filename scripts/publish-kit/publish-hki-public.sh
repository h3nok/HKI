#!/usr/bin/env bash
# publish-hki-public.sh — materialise the public open-hki/hki repo from this
# monorepo. Defaults to dry-run (writes to ./scripts/publish-kit/out/). Use --push
# with a remote URL to commit + push.
#
# Usage:
#   ./scripts/publish-kit/publish-hki-public.sh                  # dry-run
#   ./scripts/publish-kit/publish-hki-public.sh --push <url>     # commit + push
#   ./scripts/publish-kit/publish-hki-public.sh --out /tmp/foo   # custom output dir
#
# Safe by default: never deletes anything in the source repo, never
# force-pushes, refuses to push into an existing populated branch.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
INCLUDED_PATHS="${SCRIPT_DIR}/INCLUDED_PATHS"
TEMPLATES_DIR="${SCRIPT_DIR}/templates"

OUT_DIR="${SCRIPT_DIR}/out"
PUSH_URL=""
BRANCH="main"
COMMIT_MESSAGE="Initial public release of HKI"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --push)        PUSH_URL="$2"; shift 2;;
    --out)         OUT_DIR="$2"; shift 2;;
    --branch)      BRANCH="$2"; shift 2;;
    --message|-m)  COMMIT_MESSAGE="$2"; shift 2;;
    -h|--help)
      grep -E '^#( |$)' "$0" | sed -E 's/^#( |$)//'
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

echo "==> source : ${REPO_ROOT}"
echo "==> output : ${OUT_DIR}"
echo "==> branch : ${BRANCH}"
[[ -n "${PUSH_URL}" ]] && echo "==> push to: ${PUSH_URL}"
echo

if [[ -e "${OUT_DIR}" ]]; then
  echo "==> clearing existing output dir"
  rm -rf "${OUT_DIR}"
fi
mkdir -p "${OUT_DIR}"

# 1. Copy whitelisted paths from the source monorepo.
echo "==> copying whitelisted paths"
copied=0
while IFS= read -r line; do
  # strip comments / blank lines
  path="${line%%#*}"
  path="${path## }"
  path="${path%% }"
  [[ -z "${path}" ]] && continue

  src="${REPO_ROOT}/${path}"
  dst="${OUT_DIR}/${path}"
  if [[ ! -e "${src}" ]]; then
    echo "    SKIP (missing): ${path}" >&2
    continue
  fi

  mkdir -p "$(dirname "${dst}")"
  if [[ -d "${src}" ]]; then
    # rsync-style copy excluding generated artifacts
    mkdir -p "${dst}"
    (cd "${src}" && find . -type f \
        ! -path '*/node_modules/*' \
        ! -path '*/.venv/*' \
        ! -path '*/.turbo/*' \
        ! -path '*/dist/*' \
        ! -path '*/build/*' \
        ! -path '*/__pycache__/*' \
        ! -path '*/.pytest_cache/*' \
        ! -path '*/.ruff_cache/*' \
        ! -path '*/.mypy_cache/*' \
        ! -name '*.pyc' \
        ! -name '.DS_Store' \
        -print0) | (cd "${src}" && tar --null -cf - -T -) | (cd "${dst}" && tar -xf -)
  else
    cp "${src}" "${dst}"
  fi
  copied=$((copied + 1))
done < "${INCLUDED_PATHS}"
echo "    ${copied} entries copied"

# 2. Lay down template files (root README, LICENSE, CI, package.json, ...).
echo "==> applying templates"
cp -R "${TEMPLATES_DIR}/." "${OUT_DIR}/"

# 3. Sanity checks.
echo "==> sanity checks"
fail=0
for f in README.md LICENSE package.json pnpm-workspace.yaml \
         packages/hki-runtime/package.json \
         packages/hki-runtime-py/pyproject.toml \
         packages/hki-langchain/pyproject.toml \
         packages/hki-llamaindex/pyproject.toml \
         packages/hki-adk/pyproject.toml \
         packages/hki-autogen/pyproject.toml \
         packages/hki-crewai/pyproject.toml \
         packages/hki-integration-tests/pyproject.toml \
         scripts/build-conformance-registry.mjs \
         examples/end_to_end_demo.py \
         docs/HKI_ADAPTERS.md \
         .github/workflows/ci.yml; do
  if [[ ! -e "${OUT_DIR}/${f}" ]]; then
    echo "    MISSING: ${f}" >&2
    fail=1
  fi
done
[[ "${fail}" -ne 0 ]] && { echo "sanity checks failed" >&2; exit 1; }
echo "    all required files present"

# 4. Strip references to private apps / services (defence in depth).
echo "==> sanitising private references"
# Note: scripts/audit-hki-conformance.mjs and scripts/hki_ast_audit.py keep
# their SCAN_ROOTS lists as-is — they already skip-if-missing at runtime,
# so external users get a no-op for those roots and the scripts remain
# usable inside any larger monorepo that drops HKI in.
#
# We do, however, prepend a one-line clarifier to docs that reference
# private services so external readers understand the context.
PRIVATE_DOCS=(
  "docs/HKI_ROADMAP.md"
  "docs/ARCHITECTURE.md"
)
for doc in "${PRIVATE_DOCS[@]}"; do
  f="${OUT_DIR}/${doc}"
  [[ -f "${f}" ]] || continue
  if ! grep -q "private reference implementation" "${f}"; then
    tmp="$(mktemp)"
    {
      echo "> **Note for external readers.** Some sections below reference"
      echo "> service names (e.g. \`apps/agentic\`, \`knowledge-api\`,"
      echo "> \`ingestion-pipeline-service\`, \`orchestrator-service\`,"
      echo "> \`analytics-service\`) that live in HKI's *private reference"
      echo "> implementation*. They are mentioned here as illustrative"
      echo "> examples of how HKI is integrated into a real platform; the"
      echo "> code itself is not part of this public repo."
      echo
      cat "${f}"
    } > "${tmp}"
    mv "${tmp}" "${f}"
    echo "    annotated: ${doc}"
  fi
done

echo "==> scanning for leaks"
leaked=0
for needle in "apps/agentic" "knowledge-api" "ingestion-pipeline-service" \
              "orchestrator-service" "analytics-service" "services/" \
              "docker-compose"; do
  hits=$(grep -rIln --exclude-dir=.git "${needle}" "${OUT_DIR}" 2>/dev/null \
         | grep -vE '/(docs/HKI_ROADMAP\.md|docs/ARCHITECTURE\.md|scripts/hki_ast_audit\.py|scripts/audit-hki-conformance\.mjs|scripts/hki-ast-audit-ts\.mjs)$' \
         || true)
  if [[ -n "${hits}" ]]; then
    echo "    !! references to '${needle}' (unexpected location):"
    echo "${hits}" | sed 's|^|        |'
    leaked=1
  fi
done
[[ "${leaked}" -eq 0 ]] && echo "    no unexpected leaks"

# 5. Initialise git, commit, optionally push.
echo "==> initialising git repo"
(
  cd "${OUT_DIR}"
  git init -q -b "${BRANCH}"
  git add .
  git -c user.email="bot@open-hki.dev" -c user.name="HKI publish-kit" \
      commit -q -m "${COMMIT_MESSAGE}"
)

count=$(cd "${OUT_DIR}" && git ls-files | wc -l | tr -d ' ')
echo "    ${count} files committed"

if [[ -z "${PUSH_URL}" ]]; then
  echo
  echo "==> dry-run complete. Inspect: ${OUT_DIR}"
  echo "    To push: $0 --push <git-url>"
  exit 0
fi

# 6. Push.
echo "==> pushing to ${PUSH_URL}"
(
  cd "${OUT_DIR}"
  git remote add origin "${PUSH_URL}"
  # Refuse if remote branch already has commits.
  if git ls-remote --exit-code "${PUSH_URL}" "refs/heads/${BRANCH}" >/dev/null 2>&1; then
    echo "    \u2717 remote branch ${BRANCH} already exists; refusing to overwrite." >&2
    echo "      Push manually with: cd ${OUT_DIR} && git push origin ${BRANCH}" >&2
    exit 1
  fi
  git push -u origin "${BRANCH}"
)

echo
echo "==> done. Public repo published to ${PUSH_URL}"
