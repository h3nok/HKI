# HKI — Hermetic Knowledge Isolation

**The control framework for the uncharted agentic era.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Standard: HKI 1.0](https://img.shields.io/badge/Standard-HKI%201.0%20Draft-green)](./spec/HKI-1.0.md)
[![npm: @hki/runtime](https://img.shields.io/badge/npm-%40hki%2Fruntime-cb3837)](./packages/hki-runtime)
[![PyPI: hki-runtime](https://img.shields.io/badge/PyPI-hki--runtime-3775a9)](./packages/hki-runtime-py)

---

> **One request. One active domain. No implicit global visibility.**

The agentic era is uncharted, and enterprises are already at risk. Autonomous
systems can retrieve, reason, call tools, cache context, retain memory, and
trigger workflows faster than existing controls can explain or contain. HKI is
the control framework for that world: signed domains, scoped RAG, scoped MCP
tools, scoped memory, scoped caches, scoped traces, and explicit knowledge
publication.

Enterprise AI systems built on RAG, MCP tools, and agentic workflows share a
structural problem: without a runtime contract, agents silently retrieve, cache,
and reason across domain boundaries. A pharmacy agent reads supplier pricing. A
travel agent surfaces member financial records. An MCP tool inherits a scope it
was never authorized for. This is not a configuration error — it is a missing
architectural primitive.

HKI defines that primitive and provides the runtime, conformance harness, and
reference implementation to enforce it.

**Validated in production across 14 enterprise domains including pharmacy,
optical, travel, membership, and warehouse operations at a Fortune 15 retailer.**

---

## The Contract

An HKI-conformant runtime must prove:

| Invariant                  | Requirement                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------- |
| **Single label**           | Every runtime artifact carries exactly one non-null domain label                       |
| **Single active domain**   | Every request executes inside exactly one active domain                                |
| **Exact-match visibility** | Runtime reads require exact domain equality — no inheritance, no wildcards             |
| **Fail-closed**            | Missing, null, `global`, ambiguous, or unauthorized scope fails closed                 |
| **Explicit publication**   | Cross-domain sharing happens only through explicit publication — never silent fallback |
| **Plane separation**       | Admin-plane cross-domain inspection is unreachable from runtime routes                 |

The full normative standard is in [spec/HKI-1.0.md](./spec/HKI-1.0.md).
The custody research note is in [docs/HKI-package/custody_problem.md](./docs/HKI-package/custody_problem.md).
The complete architecture paper is in [docs/HKI-package/HERMETIC-KNOWLEDGE-ISOLATION.md](./docs/HKI-package/HERMETIC-KNOWLEDGE-ISOLATION.md).

---

## Why This Exists

Standard access control protects data at rest. HKI protects knowledge in motion — through retrieval, rewriting, caching, graph traversal, tool invocation, memory, and async jobs. Each of these stages can dissolve scope that was correctly set at the gateway if isolation is not a runtime invariant.

As agents gain the ability to rewrite context, call tools, spawn jobs, and persist memory, the attack surface grows in proportion to their autonomy. A read-only RAG pipeline needs a filter. A fully autonomous agent needs an execution boundary. HKI is that boundary — defined as a signed envelope that propagates unchanged from gateway to retrieval to tool to job to audit.

For the full threat model: [docs/HKI_THREATS.md](./docs/HKI_THREATS.md).
For OWASP/NIST/MCP alignment: [docs/HKI_SECURITY_MAPPING.md](./docs/HKI_SECURITY_MAPPING.md).

---

## Try it in 5 minutes

```bash
pip install hki-runtime
```

Open the [quickstart notebook](./notebooks/01_quickstart.ipynb) — or run it directly in
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/h3nok/HKI/blob/main/notebooks/01_quickstart.ipynb)

The notebook shows the cache leak problem, the envelope fix, artifact visibility, and gateway enforcement in under 5 minutes. No LLM API key required.

---

## Three Ways to Use HKI

### 1. Read the Standard

Start here if you are evaluating HKI for your architecture or writing a
conformant adapter.

- [HKI 1.0 Draft Standard](./spec/HKI-1.0.md) — normative invariants, envelope schema, conformance levels
- [The Custody Problem](./docs/HKI-package/custody_problem.md) — research framing for inference-time data sovereignty, usage control, provenance, multi-domain delegation, derived artifacts, and falsifiable conformance checks
- [HKI Agent Gateway Profile](./spec/HKI-Agent-Gateway-Profile.md) — gateway enforcement requirements
- [Architecture Paper](./docs/HKI-package/HERMETIC-KNOWLEDGE-ISOLATION.md) — full system model, reference architecture, implementation surface, migration path
- [Scoped Agentic Routing](./docs/SCOPED_AGENTIC_ROUTING.md) — operational runtime standard
- [Conformance Guide](./docs/HKI_CONFORMANCE.md) — conformance levels and release evidence

### 2. Use the Runtime Packages

Drop-in TypeScript and Python helpers for envelope validation, artifact
visibility checks, cache-key derivation, and gateway routing decisions.

```bash
# TypeScript / Node.js
npm install @hki/runtime

# Python
pip install hki-runtime
```

| Package                                                       | Language      | Purpose                                                                                                     |
| ------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| [`@hki/runtime`](./packages/hki-runtime)                      | TypeScript    | Envelope validation, artifact visibility, cache keys, gateway decisions, telemetry attributes, JSON Schemas |
| [`hki-runtime-py`](./packages/hki-runtime-py)                 | Python        | FastAPI middleware, gateway helpers, retrieval adapters, cache derivation, MCP tool router                  |
| [`@hki/conformance`](./packages/hki-conformance)              | TypeScript    | 28-case conformance test suite, CLI runner, machine-readable evidence report                                |
| [`hki-conformance-action`](./packages/hki-conformance-action) | GitHub Action | CI/CD conformance gate — fails the build if your adapter does not pass HKI                                  |

**Framework adapters** (in development):

| Adapter                                       | Framework                    |
| --------------------------------------------- | ---------------------------- |
| [`hki-langchain`](./packages/hki-langchain)   | LangChain                    |
| [`hki-llamaindex`](./packages/hki-llamaindex) | LlamaIndex                   |
| [`hki-crewai`](./packages/hki-crewai)         | CrewAI                       |
| [`hki-autogen`](./packages/hki-autogen)       | AutoGen                      |
| [`hki-adk`](./packages/hki-adk)               | Google Agent Development Kit |

### 3. Run Conformance Against Your Implementation

```bash
npx @hki/conformance ./your-adapter.js

# Output:
# ✓ envelope validation        6/6
# ✓ artifact visibility        8/8
# ✓ cache key binding          4/4
# ✓ tool routing               6/6
# ✓ scope override rejection   4/4
# HKI Conformance: PASS (28/28)
```

Add it to CI with the [GitHub Action](./packages/hki-conformance-action).

---

## The Full Reference Platform

This repository is not only the standard and packages — it is the complete
production-shaped reference implementation: gateway, orchestrator, knowledge
retrieval, ingestion, analytics, and UI control surface, all enforcing HKI
invariants end-to-end.

### Services

| Service                      | Port | Purpose                                                                   |
| ---------------------------- | ---- | ------------------------------------------------------------------------- |
| `apps/agentic`               | 9001 | React BFF + tRPC control surface                                          |
| `knowledge-api`              | 9509 | Hybrid vector + BM25 + graph search, MCP server, ingestion, taxonomy      |
| `orchestrator-service`       | 9501 | ReAct supervisor, intent routing, tool registry, Redis memory, guardrails |
| `ingestion-pipeline-service` | 9508 | Document upload, chunking, quality gates, async Pub/Sub worker            |
| `analytics-service`          | 9510 | Usage analytics, event ingest, query tracing                              |
| `litellm-gateway`            | 4000 | LLM proxy with auth, routing, quota, and guardrails                       |

**Infrastructure:** GKE (Terraform), AlloyDB/pgvector, Redis, Neo4j, Pub/Sub.

---

## Quick Start (Local Development)

**Prerequisites:** Python 3.12+, Node.js 24+, pnpm 11+, Docker 24+, `uv`

```bash
# 1. Clone and set up environment
git clone https://github.com/h3nok/HKI.git
cd HKI
make init-env           # copies .env.example files
make validate-env       # checks required vars

# 2. Start infrastructure (PostgreSQL, Redis, Neo4j)
make infra-up

# 3. Install dependencies
make install

# 4. Start all services
make dev-full
# → UI at http://localhost:9001/engineering
```

Set `VERTEX_PROJECT` to your GCP project and place your service account key at
`deploy/compose/creds/gcp_creds.json` before starting.

Full setup guide: [docs/FIRST_SETUP.md](./docs/FIRST_SETUP.md).
Environment reference: [docs/ENV_SETUP.md](./docs/ENV_SETUP.md).

---

## Testing and Conformance

```bash
make hki-check              # runtime, Python runtime, conformance, and audit gates
pnpm test:hki-runtime       # TypeScript runtime unit tests
pnpm test:hki-runtime-py    # Python runtime unit tests
pnpm test:hki-conformance   # 28-case conformance suite
pnpm verify:hki-conformance # adapter conformance CLI
pnpm audit:hki              # ratchet known scope fallback debt
make test-services          # pytest all Python services
make e2e-test               # end-to-end ingestion test
```

## Community

HKI is organized as an open standard plus reusable runtimes, conformance tools,
adapters, and a production-shaped reference platform. Start with
[CONTRIBUTING.md](./CONTRIBUTING.md) and
[docs/COMMUNITY_ENABLEMENT.md](./docs/COMMUNITY_ENABLEMENT.md) to choose the
right contribution lane and validation bar.

---

## Deployment

```bash
make deploy             # canonical GKE deployment
make status             # show GKE deployment status
DRY_RUN=true make gke-deploy  # preview without executing
```

Production infrastructure is Terraform-managed on GKE. See
[deploy/k8s/](./deploy/k8s/) for cluster, database, networking, and
observability configuration.

---

## Repository Layout

```
hki/
├── spec/                       # Normative standards (HKI 1.0, Agent Gateway Profile)
├── docs/                       # Architecture paper, threat model, ops guides, security mapping
├── packages/
│   ├── hki-runtime/            # @hki/runtime — TypeScript
│   ├── hki-runtime-py/         # hki-runtime — Python
│   ├── hki-conformance/        # @hki/conformance — 28-case test suite + CLI
│   ├── hki-conformance-action/ # GitHub Action conformance gate
│   ├── hki-langchain/          # LangChain adapter
│   ├── hki-llamaindex/         # LlamaIndex adapter
│   ├── hki-crewai/             # CrewAI adapter
│   ├── hki-autogen/            # AutoGen adapter
│   ├── hki-adk/                # Google ADK adapter
│   └── ui/                     # @hki/ui — design system
├── apps/agentic/               # React BFF + engineering hub UI
├── knowledge-api/              # Retrieval and knowledge graph service
├── orchestrator-service/       # Agent orchestration and routing
├── ingestion-pipeline-service/ # Document processing pipeline
├── analytics-service/          # Usage and query analytics
├── deploy/                     # Kubernetes manifests and Terraform
├── examples/                   # Threat modeling and integration examples
└── tests/                      # End-to-end and platform verification
```

---

## Contributing

HKI is an open standard. Contributions are welcome across:

- **Adapter implementations** — complete the LangChain, LlamaIndex, CrewAI, AutoGen, and ADK adapters
- **Conformance tests** — additional adversarial cases for scope bleed, cache contamination, and tool overreach
- **Language ports** — Java, Go, or Rust runtime helpers
- **Case studies** — production deployment notes and architecture reviews

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/HKI_PUBLIC_READINESS_PLAN.md](./docs/HKI_PUBLIC_READINESS_PLAN.md).

For conformance questions, security issues, or enterprise deployment support:
open an issue or reach out via the repository discussions.

---

## Citation

If you use HKI in research or a production system, please cite:

```bibtex
@misc{ghebrechristos2025hki,
  title   = {Hermetic Knowledge Isolation: A Runtime Contract for Domain-Isolated Agentic Systems},
  author  = {Ghebrechristos, Henok},
  year    = {2025},
  url     = {https://github.com/h3nok/HKI}
}
```

---

## License

MIT. See [LICENSE](./LICENSE).

---

_HKI is designed, authored, and maintained by [Henok Ghebrechristos, PhD](https://github.com/h3nok)._
_Validated in production at enterprise scale._
