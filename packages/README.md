# HKI Packages

This directory contains the reusable HKI framework packages plus shared
frontend packages used by the reference Agentic app. Treat the runtime and
conformance packages as the public framework surface; treat the UI packages as
public-preview until the token audit debt is burned down or legacy/demo
surfaces are carved out.

## Public Framework Packages

### [@hki/runtime](./hki-runtime)

TypeScript runtime helpers for the HKI envelope, artifact visibility, cache-key
derivation, gateway target decisions, telemetry attributes, and JSON Schemas.

### [hki-runtime](./hki-runtime-py)

Python runtime helpers that mirror `@hki/runtime` for FastAPI services, Python
gateways, retrieval adapters, caches, and MCP tool routers.

### [@hki/conformance](./hki-conformance)

Runnable HKI conformance cases, adapter contract, CLI runner, and evidence
report for HKI-compatible gateways and agent runtimes.

### [@hki/sdk](./sdk)

Single TypeScript entry point for HKI runtime primitives and the conformance
runner. Use this when you want one dependency for implementing and verifying
HKI boundaries.

**What's included:**

- Runtime exports from `@hki/runtime`
- Conformance exports from `@hki/conformance`
- Subpath imports for `@hki/sdk/runtime` and `@hki/sdk/conformance`

## Public-Preview Frontend Packages

### [@hki/chat](./chat)

Shared React components, hooks, adapters, and types for chat interfaces in
HKI-compatible apps.

**Used by:** `apps/agentic`

### [@hki/ui](./ui)

HKI component library built with Tailwind CSS and Radix UI.

**What's included:**

- Accessible React primitives such as Button, Card, Dialog, and Input
- Design token system with primitive and semantic token layers
- Agentic theme for the HKI reference app
- Storybook documentation
- Exportable Tailwind config

**Status:** `pnpm audit:ui-tokens` is currently a ratchet. Do not treat this as
a final public design-system release until the hardcoded color findings are
zero or legacy/demo surfaces are excluded from the published package.

## Internal Tooling Packages

### [@hki/typescript-config](./typescript-config)

Shared TypeScript configurations for consistency across TypeScript projects.

### [@hki/eslint-config](./eslint-config)

Shared ESLint rules and configurations for code quality.

## Development

### Installing Dependencies

```bash
pnpm install
```

### Building Packages

```bash
# Build every workspace package
pnpm build:framework

# Build one package
pnpm --dir packages/hki-runtime build
pnpm --dir packages/hki-conformance build
pnpm --dir packages/sdk build
```

### Verifying HKI Conformance

```bash
pnpm audit:hki
pnpm verify:hki-conformance
```

### Using Packages in Apps

Packages are referenced using the `workspace:*` protocol in local
`package.json` files:

```json
{
  "dependencies": {
    "@hki/runtime": "workspace:*",
    "@hki/conformance": "workspace:*",
    "@hki/sdk": "workspace:*"
  }
}
```

### Package Structure

Most packages follow this structure:

```text
package/
├── src/
├── dist/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```

## Monorepo Setup

This monorepo uses:

- **pnpm workspaces** for package management and linking
- **Turbo** for cached package tasks
- **tsup** for TypeScript package bundling

See the root `pnpm-workspace.yaml` and `turbo.json` for configuration.

## Publishing Notes

- The monorepo root is private, but publishable framework packages use
  `publishConfig.access = "public"`.
- `@hki/runtime`, `@hki/conformance`, `@hki/sdk`, and `hki-runtime` are the
  primary open-source framework packages.
- `@hki/ui` and `@hki/chat` are available for reference-app development, but
  remain public-preview until the UI token audit is clean.
- Packages are built before dependents through Turbo's `dependsOn: ["^build"]`
  configuration.
