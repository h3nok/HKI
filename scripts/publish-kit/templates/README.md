# HKI — Hermetic Knowledge Isolation

[![CI](https://github.com/open-hki/hki/actions/workflows/ci.yml/badge.svg)](https://github.com/open-hki/hki/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**HKI** is a runtime + spec for keeping agentic AI systems honest about
*whose data they're allowed to look at, whose tools they're allowed to call,
and whose answers they're allowed to return.* It's a portable enforcement
layer — not a framework — that plugs into LangChain, LlamaIndex, Google
ADK, Microsoft AutoGen, CrewAI, and LiteLLM.

## What you get

- **`@hki/runtime`** (TypeScript) and **`hki-runtime`** (Python) — the
  core: signed envelope, scope policy, gateway-target evaluator,
  artifact-visibility check, deterministic cache-key derivation.
- **Six framework adapters** — drop-in callbacks / wrappers / tool
  guards for the major agent stacks. All duck-typed (no hard dep).
- **`@hki/conformance`** — the spec as 28 executable test cases. Run
  them against your implementation to claim conformance.
- **`hki-conformance-action`** — a GitHub Action that runs the
  conformance suite + AST audit on every PR.
- **15 runnable threat demos** in [`examples/threats/`](./examples/threats/) —
  break a RAG in 60 seconds, then watch HKI block the same attack.
- **End-to-end demo** — [`examples/end_to_end_demo.py`](./examples/end_to_end_demo.py)
  walks one envelope through every adapter.

## The five invariants every adapter enforces

1. **Envelope required.** No signed envelope → `missing-envelope`.
2. **Envelope must validate.** Widened or expired → `envelope-invalid`.
3. **No body-scope-trust.** Conflicting `scope` field on a payload →
   `scope-override`.
4. **Tool / model gateway-target check.** Target in unauthorized
   domain → `gateway-denied`.
5. **Artifact-visibility check.** Retriever returns a doc labelled for a
   different domain → `artifact-scope-mismatch`.

Plus three integrity invariants (session, stream, crew consistency)
where the framework supports them.

See [`docs/HKI_ADAPTERS.md`](./docs/HKI_ADAPTERS.md) for the full index.

## Quick start

### Install

```bash
# TypeScript
pnpm add @hki/runtime

# Python (pick the adapter for your framework)
pip install hki-runtime hki-langchain
# or hki-llamaindex, hki-adk, hki-autogen, hki-crewai, hki-litellm
```

### LangChain example

```python
from hki_langchain import HkiCallbackHandler

chain.invoke(
    {"question": "..."},
    config={
        "callbacks": [HkiCallbackHandler()],
        "metadata": {"hki_envelope": signed_envelope_dict},
    },
)
```

### LiteLLM example

```python
import litellm
from hki_litellm import HkiLiteLLMCallback

litellm.callbacks = [HkiLiteLLMCallback()]

litellm.completion(
    model="openai/gpt-4o",
    messages=[{"role": "user", "content": "..."}],
    metadata={"hki_envelope": signed_envelope_dict},
)
```

See [`docs/HKI_ADAPTERS.md`](./docs/HKI_ADAPTERS.md) for examples for
every framework.

## Run the demo

```bash
pnpm install
uv sync --project packages/hki-runtime-py --extra dev
pnpm demo:hki
```

You'll see one envelope walk through all six adapters, with the
authorized path allowed and every threat denied.

## Conformance

Claim HKI conformance by running the suite against your implementation:

```bash
pnpm verify:hki-conformance
```

28 executable cases, each tagged `must` / `should` / `may`. The
[`scripts/build-conformance-registry.mjs`](./scripts/build-conformance-registry.mjs)
script produces a `conformance.json` evidence artifact at one of three
levels: `L1-self-attested`, `L2-tested`, `L3-evidenced`.

The `hki-conformance-action` runs all of this on every PR.

## Repository layout

```
packages/
  hki-runtime/              # TypeScript runtime
  hki-runtime-py/           # Python runtime
  hki-conformance/          # Spec as 28 executable cases
  hki-conformance-action/   # GitHub Action
  hki-litellm/              # LiteLLM gateway adapter
  hki-langchain/            # LangChain / LangGraph adapter
  hki-llamaindex/           # LlamaIndex adapter
  hki-adk/                  # Google ADK adapter
  hki-autogen/              # Microsoft AutoGen adapter
  hki-crewai/               # CrewAI adapter
  hki-integration-tests/    # Cross-adapter end-to-end suite
examples/
  threats/                  # 15 runnable threat demos
  end_to_end_demo.py        # Single-process showcase
scripts/                    # AST audit + conformance registry build
docs/
  HKI_ROADMAP.md
  HKI_ADAPTERS.md
  HKI_THREATS.md
  HKI_CONFORMANCE.md
  HKI_SECURITY_MAPPING.md
  ARCHITECTURE.md
```

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Security issues:
[`SECURITY.md`](./SECURITY.md).

## License

MIT — see [`LICENSE`](./LICENSE).
