# HKI Roadmap

This file is the **public-facing summary** of where HKI is headed.
The full engineering roadmap with milestone definitions, DoD criteria, and ADR backlog is at
[docs/HKI_ROADMAP.md](./docs/HKI_ROADMAP.md).

---

## Where we are now (v0.1.0 · May 2026)

HKI ships a working standard, two language runtimes, a 28-case conformance kit, a Python conformance mirror, a 15-entry threat catalog with runnable demos, six framework adapters (LiteLLM, LangChain, LlamaIndex, AutoGen, CrewAI, Google ADK), an MCP guard, a CI/CD conformance action, an evidence registry, HTTP probe tooling, and a full production reference platform — validated across **14 enterprise domains at a Fortune 15 retailer**.

Conformance level of the reference platform: **L4 smoke-evidenced** (28/28 adapter cases pass; 10/10 HTTP probes pass against the CI mock gateway; Cloud Run probe workflow exists for live external evidence bundles).

---

## Next six milestones

| #   | Milestone                         | What ships                                                                                                                                   | Target  |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | **Package publication**           | `@hki/runtime`, `@hki/conformance` on npm; `hki-runtime` on PyPI; all adapters installable                                                   | Q2 2026 |
| 2   | **Python conformance kit (M2.2)** | Done locally/CI: Python `hki-conformance` CLI mirrors all 28 cases; `hki-conformance-py` runs via `pytest`                                   | Q2 2026 |
| 3   | **L4 probe (M7 full)**            | Done for smoke evidence: `hki probe` HTTP suite passes against the mock gateway; next release artifact should attach live Cloud Run evidence | Q2 2026 |
| 4   | **MCP adapter (M12)**             | `hki-mcp` middleware wraps any MCP server; tool, resource, and prompt registries domain-bound                                                | Q3 2026 |
| 5   | **AWS reference (M13)**           | EKS + Bedrock + Aurora pgvector + OpenSearch reference — removes GCP-only objection                                                          | Q3 2026 |
| 6   | **Three design partners (M25)**   | One regulated enterprise, one AI-native vendor, one OSS project — anonymized findings published                                              | Q3 2026 |

After these six: `hki.dev` public site → OWASP/CNCF ecosystem submissions → HKI 1.0 stable release.

---

## What HKI will never do

- Become a platform product with a login wall.
- Ship a proprietary "HKI Certified" mark that requires a vendor relationship.
- Require any specific cloud, LLM provider, or vector store.

The standard is the product. Everything else is evidence that the standard works.

---

See [docs/HKI_ROADMAP.md](./docs/HKI_ROADMAP.md) for the complete track-by-track plan,
conformance level definitions, risk register, and open ADRs.
