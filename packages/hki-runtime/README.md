# @hki/runtime

Reference TypeScript runtime helpers for HKI 1.0.

HKI treats runtime scope as a signed envelope, not as a loose query parameter.
This package provides the minimal primitives needed by gateways, agent
orchestrators, retrieval services, memory stores, and caches.

## Install

```bash
pnpm add @hki/runtime
```

## Runtime Envelope

```ts
import { validateEnvelope } from "@hki/runtime";

const rawEnvelope = JSON.parse(
  String(request.headers["x-hki-envelope"] ?? "{}")
);
const validation = validateEnvelope(rawEnvelope, {
  requireSignature: true,
});

if (!validation.ok) {
  throw new Error(validation.issues.map(issue => issue.message).join("; "));
}

const envelope = validation.envelope;
```

An accepted envelope must have exactly one non-global, non-wildcard
`active_domain`, a non-empty `authorized_domains` set containing that active
domain, valid issue and expiry timestamps, and an optional or required signature
depending on the runtime boundary.

## Artifact Visibility

```ts
import { assertArtifactVisible } from "@hki/runtime";

const issue = assertArtifactVisible(envelope, {
  org_id: "org_acme",
  domain: "payments",
  artifact_type: "document",
  artifact_id: "doc_123",
});

if (issue) {
  throw new Error(issue.message);
}
```

Runtime reads must match both `org_id` and `active_domain`. Membership in
`authorized_domains` is not enough to make another domain visible. Artifacts
labeled `global` or `*` are rejected before visibility is evaluated.

## Cache Keys

```ts
import { deriveHkiCacheKey } from "@hki/runtime";

const key = deriveHkiCacheKey({
  envelope,
  operation: "retrieval.search",
  input: { query: "refund policy" },
  model_route: "gpt-5.4",
  context_version: "kb-v1",
});
```

The derived key includes organization, active domain, purpose, operation, policy
pack, model route, context version, and a stable fingerprint of the input.

## Gateway Targets

```ts
import {
  evaluateGatewayTarget,
  rejectConflictingScopeArgument,
} from "@hki/runtime";

const override = rejectConflictingScopeArgument(envelope, req.body);
if (override) {
  throw new Error(override);
}

const decision = evaluateGatewayTarget(envelope, {
  type: "tool",
  id: "retrieval.search",
  domain: "payments",
});

if (!decision.allowed) {
  throw new Error(decision.reason);
}
```

## Schemas

The package publishes JSON Schema artifacts for non-TypeScript implementations:

```ts
import envelopeSchema from "@hki/runtime/schema/hki-envelope.schema.json";
import artifactSchema from "@hki/runtime/schema/hki-artifact-label.schema.json";
```

The schema is a shape contract. Implementations must still enforce the HKI
visibility rule that the active domain appears inside `authorized_domains`.
