# HKI Service Evidence

`scripts/hki-service-evidence.mjs` is the reference-app black-box evidence
runner for service boundaries. It complements the package conformance kit by
probing the running Python services with the same short-lived service JWT shape
that the Agentic BFF signs for downstream calls.

## What It Proves

For each selected service route, the runner verifies:

- valid non-global scoped JWTs are accepted
- missing, malformed, expired, and wrong-signature JWTs are rejected
- missing runtime scope is rejected
- `global` scope and `global` inside `scopes` are rejected
- cross-stream requests are rejected where the route accepts a stream selector
- cross-org analytics summary requests are rejected

The output is a JSON evidence bundle with pass/fail results and a bundle hash.

## Commands

Run the default suite against the normal local ports:

```bash
pnpm evidence:hki-services
```

Write to a specific artifact path:

```bash
pnpm evidence:hki-services -- --out artifacts/hki/service-evidence.local.json
```

Run the package conformance kit and then service evidence:

```bash
pnpm evidence:hki
```

The Make target is equivalent to the service evidence command:

```bash
make hki-service-evidence
```

To start the full strict-auth validation stack, run evidence against all four
Python services, and tear the validation stack down automatically:

```bash
make hki-service-evidence-auth
```

## Auth-Enabled Local KB Proof

`make dev-full` intentionally starts the main local Python services with
`AUTH_ENABLED=false` for developer ergonomics. In that mode, missing-token
negative probes should fail because the dev bypass is active.

For strict local proof of the Knowledge API and ingestion service, start the
auth-enabled KB validation stack:

```bash
make dev-kb-auth
pnpm evidence:hki-services -- \
  --targets knowledge-api,ingestion-pipeline \
  --knowledge-api-url http://127.0.0.1:9609 \
  --ingestion-pipeline-url http://127.0.0.1:9608 \
  --secret kb-auth-local-dev-secret-1234567890
make dev-kb-auth-stop
```

## Auth-Enabled Full Service Proof

For full strict local proof of Knowledge API, ingestion, Orchestrator, and
Analytics, use the isolated auth-enabled service stack:

```bash
make dev-service-auth
pnpm evidence:hki-services -- \
  --knowledge-api-url http://127.0.0.1:9609 \
  --ingestion-pipeline-url http://127.0.0.1:9608 \
  --orchestrator-url http://127.0.0.1:9601 \
  --analytics-url http://127.0.0.1:9610 \
  --secret kb-auth-local-dev-secret-1234567890
make dev-service-auth-stop
```

These services are started with:

```bash
AUTH_ENABLED=true
KB_HERMETIC_ISOLATION=true
SERVICE_AUTH_SECRET=<same secret used by the runner>
```

## Bundle Shape

The artifact is written to `artifacts/hki/service-evidence.json` by default:

```json
{
  "hki_version": 1,
  "profile": "strict-jwt-service-boundaries",
  "generated_at": "2026-05-09T00:00:00.000Z",
  "configuration": {
    "domain": "pharmacy",
    "other_domain": "optical",
    "org": "default",
    "other_org": "other-org",
    "timeout_ms": 10000
  },
  "target_count": 4,
  "passed": 0,
  "failed": 0,
  "skipped": 0,
  "results": [],
  "bundle_hash": "..."
}
```

The CI HKI gate runs `make hki-service-evidence-auth` and uploads this bundle as
the `hki-service-evidence` artifact. Release notes should reference that artifact
hash when claiming service-level HKI evidence.
