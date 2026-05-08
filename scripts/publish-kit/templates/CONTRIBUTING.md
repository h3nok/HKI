# Contributing to HKI

Thanks for considering a contribution. HKI is a small project with a
sharp focus: keep agentic AI systems honest about scope.

## Ground rules

1. **Threats first.** Every new capability must come with a runnable
   threat demo under [`examples/threats/`](./examples/threats/) showing
   the attack it blocks.
2. **Spec parity.** Behavior changes require a corresponding update to
   [`packages/hki-conformance`](./packages/hki-conformance/) test cases.
3. **All adapters or none.** Any new invariant added to one adapter
   must be added to all six (or be explicitly justified as
   framework-specific).
4. **No hard framework deps.** The adapter packages must remain
   importable without their host framework installed.

## Local development

```bash
# TypeScript
pnpm install
pnpm test:hki-runtime
pnpm verify:hki-conformance

# Python (each adapter is a separate uv project)
cd packages/hki-runtime-py && uv sync --extra dev
cd packages/hki-langchain   && uv sync --extra dev
# … etc

# Run all adapters at once
pnpm test:hki-adapters
pnpm test:hki-integration

# AST audits
pnpm audit:hki-ast        # Python
pnpm audit:hki-ast-ts     # TypeScript

# End-to-end demo
pnpm demo:hki
```

## Pull-request checklist

- [ ] Tests added (unit + threat demo if applicable)
- [ ] All 16 CI gates green locally
- [ ] If touching adapters: parity across all six (or rationale)
- [ ] If touching the spec: conformance cases updated
- [ ] No hardcoded org / repo URLs

## Code of conduct

See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## License

By contributing you agree your work is licensed under the project's
[MIT license](./LICENSE).
