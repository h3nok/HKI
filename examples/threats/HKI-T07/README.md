# HKI-T07 — A2A delegation drops envelope

**Severity:** Critical
**Surface:** Multi-agent (A2A protocol, AutoGen, CrewAI, custom delegation).

Agent A delegates a sub-task to Agent B. The delegation message includes
the sub-task and history but not the signed envelope. Agent B re-mints
its own envelope (often with a service-account identity and a wider
`active_domain`) and reads / writes outside the original caller's domain.

Conformance: HKI-C03 (fail-closed missing envelope), HKI-C12 (gateway
target), HKI-C13 (publication exact-match).
