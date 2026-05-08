# HKI-T08 — Embedding cache key omits domain

**Severity:** Critical
**Surface:** Cache (embedding cache, often the second worst leak after the
response cache).

The embedding cache keyed on `(text, model)` returns identical vectors for
identical text across tenants. Even if retrieval filters correctly on domain
afterwards, **the embedding itself can leak through downstream tools** (e.g.
similarity-only routers, "find similar customers" APIs, training data export).

Conformance: HKI-C09, HKI-C10.
