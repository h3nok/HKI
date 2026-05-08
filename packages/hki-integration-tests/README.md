# hki-integration-tests

End-to-end integration test package. **Not published.** Exists to give a
single process where all six HKI adapters are imported and exercised against
the same envelope, proving they enforce the same invariants consistently.

## What it proves

1. **Envelope round-trip parity** — every adapter accepts a valid signed
   envelope and rejects an invalid one with the same denial codes.
2. **Scope-override consistency** — every adapter rejects a body with a
   conflicting `scope` field with the same denial code.
3. **Gateway-target consistency** — every adapter rejects a tool call to
   a domain not authorized for the active scope.
4. **Cache-key isolation** — every adapter's `hki_cache_key` derives a
   different key for different active domains, with the same prompt and
   model.
5. **Threat-bypass parity** — for the canonical body-scope-trust threat
   (HKI-T01), every adapter blocks it.

## Running

```bash
cd packages/hki-integration-tests
uv sync --extra dev
uv run pytest -q
```

Or from repo root:

```bash
pnpm test:hki-integration
```
