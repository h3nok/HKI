# @hki/conformance

Runnable HKI 1.0 conformance cases for gateways, agent runtimes, retrieval
services, and tool routers.

The package does not certify a vendor by itself. It creates repeatable evidence
that a runtime boundary rejects known scope-widening paths.

## Install

```bash
pnpm add -D @hki/conformance
pnpm add @hki/runtime
```

## Run the Reference Adapter

```bash
hki-conformance
```

Expected result:

```text
HKI conformance report for @hki/runtime
Result: PASS
Passed: 28
Failed: 0
```

## Test Your Gateway

Create an adapter that implements `HkiConformanceAdapter`. A starter template is
included at `templates/adapter.ts`.

```ts
import type { HkiConformanceAdapter } from "@hki/conformance";

export default {
  name: "my-agent-gateway",
  validateEnvelope(envelope) {
    return myGateway.validateEnvelope(envelope);
  },
  canReadArtifact(envelope, artifact) {
    return myGateway.canReadArtifact(envelope, artifact);
  },
  deriveCacheKey(input) {
    return myGateway.deriveCacheKey(input);
  },
  evaluateGatewayTarget(envelope, target) {
    return myGateway.evaluateGatewayTarget(envelope, target);
  },
  rejectScopeOverride(envelope, args) {
    return myGateway.rejectScopeOverride(envelope, args);
  },
} satisfies HkiConformanceAdapter;
```

Build the adapter, then run:

```bash
hki-conformance ./dist/hki-adapter.js
hki-conformance ./dist/hki-adapter.js --json
```

## Current Cases

The 0.1.0 kit includes twenty-eight cases:

- accept a signed envelope with one non-global active domain
- reject `global` as a runtime active domain
- reject wildcard runtime active domains
- reject active domains outside the authorized domain set
- reject missing active domains
- reject expired envelopes
- reject unsigned envelopes
- reject authorized domain sets that include `global`
- reject authorized domain sets that include wildcard scope
- reject unsupported HKI envelope versions
- allow exact org/domain artifact reads
- reject cross-domain artifact reads
- reject cross-organization artifact reads
- reject globally labeled artifacts
- reject wildcard-labeled artifacts
- bind cache keys to active domain
- bind cache keys to policy pack
- bind cache keys to operation
- allow active-domain tools
- allow explicitly published targets
- reject cross-domain tools
- reject global gateway targets
- reject wildcard gateway targets
- reject targets published into wildcard scope
- reject body or query arguments that override signed scope
- reject `stream_id` scope override aliases
- reject array-shaped scope override aliases
- allow explicit scope arguments only when they match signed scope

Passing this kit is Level 4 evidence for the tested adapter surface in the HKI
conformance model. Runtime or service-level claims should pair it with smoke or
live probe evidence. Level 5 requires a signed release evidence bundle and
independent review.

The repository-level registry builder writes the evidence manifest used for
public claims:

```bash
pnpm probe:smoke
pnpm registry:build
```

For release candidates, run from a clean commit with live probe evidence and the
strict release gate:

```bash
hki-probe https://your-gateway.example.com --route /v1/chat --out /tmp/hki-evidence.json
node scripts/build-conformance-registry.mjs --strict-release
```
