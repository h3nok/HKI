# HKI-T05 — Vector index shared across tenants without filter

**Severity:** Critical
**Surface:** Knowledge / vector store.

A single Pinecone/Weaviate/Qdrant collection holds vectors from multiple
domains. The `query()` call relies on developers remembering to add a
`filter={"domain": ...}`. Any code path that forgets the filter returns
cross-domain results in vector-similarity order — the highest-quality leak
the system can produce.

Conformance: HKI-C19 (artifact label binding), HKI-C12 (retrieval target).
