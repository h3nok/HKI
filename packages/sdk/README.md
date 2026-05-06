# @hki/sdk

Single TypeScript entry point for implementing and verifying Hermetic Knowledge
Isolation boundaries.

Use this package when you want one dependency that exposes both:

- HKI runtime primitives from `@hki/runtime`
- HKI conformance helpers from `@hki/conformance`

## Install

```bash
pnpm add @hki/sdk
```

For local workspace development:

```bash
pnpm install
pnpm --dir packages/sdk build
```

## Runtime Usage

```ts
import {
  deriveHkiCacheKey,
  evaluateGatewayTarget,
  validateEnvelope,
} from "@hki/sdk/runtime";

const validation = validateEnvelope(rawEnvelope, { requireSignature: true });

if (!validation.ok) {
  throw new Error(validation.issues.map(issue => issue.message).join("; "));
}

const envelope = validation.envelope;

const cacheKey = deriveHkiCacheKey({
  envelope,
  operation: "retrieval.search",
  input: { query: "refund policy" },
  modelRoute: "default",
  contextVersion: "kb-v1",
});

const decision = evaluateGatewayTarget(envelope, {
  type: "tool",
  id: "retrieval.search",
  domain: envelope.activeDomain,
});

if (!decision.allowed) {
  throw new Error(decision.reason);
}
```

## Conformance Usage

```ts
import {
  createRuntimeConformanceAdapter,
  formatConformanceReport,
  runHkiConformance,
} from "@hki/sdk/conformance";

const report = await runHkiConformance(createRuntimeConformanceAdapter());

console.log(formatConformanceReport(report));

if (!report.ok) {
  process.exitCode = 1;
}
```

## Subpath Imports

```ts
import { validateEnvelope } from "@hki/sdk/runtime";
import { runHkiConformance } from "@hki/sdk/conformance";
```

The root entry point also re-exports both surfaces:

```ts
import { validateEnvelope, runHkiConformance } from "@hki/sdk";
```

## Verification

```bash
pnpm build:hki-runtime
pnpm build:hki-conformance
pnpm build:hki-sdk
pnpm verify:hki-conformance
```

## Package Status

`@hki/sdk` is part of the public HKI framework surface. Keep examples
vendor-neutral and avoid reference-platform-only imports in this package.
