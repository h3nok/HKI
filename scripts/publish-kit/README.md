# HKI Publish Kit

This directory is the source-of-truth for the **public** `github.com/open-hki/hki`
repository. It contains the top-level files (README, LICENSE, CI, root
package.json, etc.) that exist _only_ in the public repo, plus the
`publish-hki-public.sh` script that materialises the public repo from
the curated list of paths in this monorepo.

## Files

| Path                    | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `templates/`            | Files that ship to the public repo root unchanged. |
| `publish-hki-public.sh` | The publish script. Runs in dry-run by default.    |
| `INCLUDED_PATHS`        | Whitelist of paths copied from this monorepo.      |

## What ships

The public repo gets:

- `packages/hki-runtime/`, `hki-runtime-py/`, `hki-conformance/`,
  `hki-conformance-py/`, `hki-conformance-action/`, `hki-mcp/`, `sdk/`
- `packages/hki-litellm/`, `hki-langchain/`, `hki-llamaindex/`,
  `hki-adk/`, `hki-autogen/`, `hki-crewai/`
- `packages/hki-integration-tests/`
- `examples/threats/` (15 runnable threat demos)
- `examples/end_to_end_demo.py`
- `examples/reference-k8s/` (sanitized Kubernetes reference starter)
- `scripts/{ensure-package-built.mjs,audit-public-release.mjs,hki_ast_audit.py,hki-ast-audit-ts.mjs,build-conformance-registry.mjs,audit-hki-conformance.mjs,fix-formatter-mangling.py}`
- `spec/{HKI-1.0.md,HKI-Agent-Gateway-Profile.md}`
- `docs/{COMMUNITY_ENABLEMENT.md,HKI_ROADMAP.md,HKI_ADAPTERS.md,HKI_THREATS.md,HKI_CONFORMANCE.md,HKI_SECURITY_MAPPING.md,HKI_PUBLIC_READINESS_PLAN.md,HKI_SERVICE_EVIDENCE.md,REFERENCE_ARCHITECTURE_K8S.md,PUBLIC_RELEASE_PROCESS.md,ARCHITECTURE.md}`
- The template files (root `README.md`, `LICENSE`, `CI`, etc.)
- Public CI and release workflows for TypeScript and Python package publishing

The public repo does **not** get:

- `apps/agentic/`, `services/`, `analytics-service/`, `knowledge-api/`,
  `ingestion-pipeline-service/`, `orchestrator-service/` (the reference
  implementation — stays private)
- `docker-compose/`, live `k8s/`, Terraform state, tfvars, and deployment specifics
- Anything under `tests/`, `spec/` not explicitly whitelisted

## Usage

```bash
# 1. Dry run — materialises into ./publish-kit/out/ for inspection.
./scripts/publish-kit/publish-hki-public.sh

# 2. Real run — pushes to a new GitHub repo (you create the empty repo first).
./scripts/publish-kit/publish-hki-public.sh --push git@github.com:open-hki/hki.git
```

The script never deletes anything in the source repo and never
force-pushes.

The script also runs `scripts/audit-public-release.mjs` against the generated
public output. That audit blocks Terraform state/tfvars, env files, credential
keys, private registry URLs, live project IDs, internal IPs, customer names, and
unexpected references to private app/service/deployment paths.
