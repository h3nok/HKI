# Dependency Policy

HKI tracks current stable releases aggressively, but not at the cost of
reproducibility, CI compatibility, or runtime safety.

## Runtime Baseline

- Node.js: 24+
- pnpm: 11.0.9
- Python: 3.12+

GitHub Actions, package `engines`, local docs, and the root `packageManager`
field should move together. Do not upgrade one layer without the others.

## Compatibility Holds

The following packages are intentionally held below the newest major while
their ecosystem catches up:

| Package | Current | Latest seen during upgrade | Reason |
| --- | --- | --- | --- |
| `vite` | `7.3.2` | `8.0.11` | Vite 8 is ahead of the current Storybook, Vitest, Tailwind Vite, and React plugin peer/runtime surface in this workspace. |
| `@vitejs/plugin-react` | `5.2.0` | `6.0.1` | v6 imports Vite internals that are not exported by the held Vite 7 line. |
| `typescript` | `5.9.3` | `6.0.3` | TypeScript 6 is ahead of current peer ranges in upstream packages used here. |
| `eslint` | `9.39.2` | `10.3.0` | ESLint 10 is ahead of current plugin peer ranges. |
| `esbuild` | `0.25.12` | `0.28.0` | Held to the Vite 7 peer-compatible line. |
| `@types/node` | `24.12.3` | `25.6.2` | Held to the Node 24 runtime baseline used by local development and CI. |

Revisit these holds together. The preferred migration order is Node/pnpm first,
then Vite/plugin-react/Vitest/Storybook, then TypeScript and ESLint.

## Security Overrides

Root `pnpm-workspace.yaml` overrides may pin patched transitive dependencies
when upstream packages lag. Each override should be removable, and should have
one of these reasons:

- Security patch for a transitive dependency.
- Peer-compatible de-duplication across workspace packages.
- Explicit compatibility hold documented above.

Current security-oriented overrides include:

- `postcss >=8.5.14` to avoid vulnerable older PostCSS transitively pinned by
  Next.
- `express-rate-limit >=8.5.1` and `ip-address >=10.2.0` to avoid the older
  MCP SDK transitive rate-limit chain.
- `dompurify >=3.4.2` to avoid older Monaco/Scalar sanitizer transitive pins.

Run `pnpm audit --prod` after every dependency change.

## Build Script Approvals

pnpm 11 blocks dependency install scripts unless they are explicitly approved.
The root `pnpm-workspace.yaml` allowlist is intentionally small:

- `esbuild`
- `sharp`
- `vue-demi`

Do not approve additional build scripts unless the package genuinely needs a
native install or compatibility postinstall step.
