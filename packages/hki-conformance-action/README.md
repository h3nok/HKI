# `hki-conformance-action`

Reusable composite GitHub Action that enforces the **HKI conformance gate**
on a repository's PRs. It runs the full battery — static audit, conformance
cases, threat catalog, runtime tests across all language SDKs, and an optional
HTTP probe — then emits a `conformance.json` evidence artifact and fails the
build if the produced level is below the configured minimum.

## Usage

```yaml
# .github/workflows/hki.yml
name: HKI
on: [pull_request, push]

jobs:
  hki:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - id: hki
        uses: hki-dev/hki-conformance-action@v1
        with:
          min-level: L2-baseline # default
          probe-url: https://staging.example.com # optional
      - run: echo "Level=${{ steps.hki.outputs.level }}"
```

## Inputs

| Input             | Default            | Description                                                                     |
| ----------------- | ------------------ | ------------------------------------------------------------------------------- |
| `min-level`       | `L2-baseline`      | Minimum acceptable level. Action fails if produced level is lower.              |
| `python-version`  | `3.12`             | Python version for hki-runtime-py / threats / litellm / langchain.              |
| `node-version`    | `20`               | Node version for the JS gates.                                                  |
| `pnpm-version`    | `10.0.0`           | pnpm version.                                                                   |
| `probe-url`       | _(empty)_          | If set, runs `hki-probe` against this URL and includes results in the evidence. |
| `output-path`     | `conformance.json` | Path to write the evidence artifact.                                            |
| `upload-artifact` | `true`             | Upload `conformance.json` as a workflow artifact.                               |

## Outputs

| Output          | Description                                         |
| --------------- | --------------------------------------------------- |
| `level`         | Conformance level produced (`L0..L3`).              |
| `passed`        | `"true"` if all conformance cases passed.           |
| `artifact-path` | Filesystem path of the produced `conformance.json`. |

## Levels

- **L0-non-conformant** — at least one HKI-\* conformance case failed.
- **L1-passing** — all cases pass; no audit baseline tracked.
- **L2-baseline** — all cases pass and a ratcheted audit baseline exists.
- **L3-evidenced** — L2 plus a complete threat-catalog implementation
  (`HKI-T01..HKI-T15`) demonstrated to fail closed.

See [docs/HKI_ROADMAP.md](../../docs/HKI_ROADMAP.md) for the source-of-truth
definitions and [packages/hki-conformance/schemas/conformance-registry-v1.json](../hki-conformance/schemas/conformance-registry-v1.json)
for the evidence-artifact schema.
