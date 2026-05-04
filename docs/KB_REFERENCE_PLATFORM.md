# Knowledge Base Reference Platform

## Purpose

This platform should be treated as a knowledge operating system, not a document upload utility.
Its job is to give every future knowledge-base initiative a common standard for ingestion durability, governance, evaluation, release safety, and agent consumption.

## Canonical Runtime

The reference production topology is:

1. Agentic BFF on GKE
2. Orchestrator on GKE
3. Knowledge API on GKE
4. Ingestion pipeline API on GKE
5. Ingestion pipeline worker on GKE
6. Pub/Sub for durable ingestion queueing and DLQ
7. GCS for raw source persistence and replayability
8. Redis for job state, concurrency, and transient coordination
9. AlloyDB and vector storage for indexed knowledge

## Minimum Production Bar

Every KB initiative that wants to be considered production-ready should meet all of these:

1. Durable source capture. Raw source artifacts must be recoverable after API restarts.
2. Durable queue semantics. Work must survive pod loss and restart without silent drops.
3. Worker separation. Request handling and long-running processing must not share the same failure domain.
4. Stream isolation. Value streams and tenants must be enforced server-side, fail-closed.
5. Governed promotion. New knowledge should move through review, attestation, and release gates.
6. Evaluation before promotion. Retrieval and full-agent behavior should be measured before release.
7. Replayable failure handling. Platform failures should be distinguishable from content failures and should support honest remediation.
8. Full observability. Queue depth, failure stage, source lag, freshness, citation quality, and service health must be visible.

The named target model for item 4 is Hermetic Value Stream Isolation (HVSI):

1. every runtime artifact belongs to exactly one stream
2. every runtime request executes in exactly one stream
3. shared knowledge is replicated intentionally, not exposed via null-stream fallback

See `apps/ai-platform/agentic/docs/HERMETIC-VALUE-STREAM-ISOLATION.md`.

## What Makes This Different

Most internal knowledge bases stop at indexing and search. This platform should go further:

1. It manages the full lifecycle from source ingestion to trusted agent release.
2. It treats knowledge changes like software changes, with readiness, promotion, and rollback.
3. It gives each initiative a shared operating model instead of custom one-off pipelines.
4. It keeps the UX honest about failure causes instead of blaming content for platform faults.

## Platform Capabilities

### Ingestion

1. File, text, URL, and connector-backed ingest
2. Raw artifact persistence in GCS
3. Pub/Sub-backed async processing with DLQ
4. Redis-backed job and concurrency state
5. Optional OCR/layout parsing via Document AI

### Governance

1. Review queue and approval workflow
2. Stream-aware access boundaries
3. Audit-friendly lifecycle data
4. Attestation and publish controls

### Agent Readiness

1. Evaluation suite generation
2. End-to-end agent eval runs
3. Launch readiness checks
4. Release candidates, promotion, and rollback

## Adoption Standard For New KB Initiatives

If a new team wants a knowledge base, they should inherit this platform and customize only:

1. Value stream and access model
2. Source connectors and taxonomy
3. Evaluation suite and readiness thresholds
4. Review policy and release cadence

They should not build a separate ingestion runtime, queue model, or promotion workflow unless there is a hard technical reason.

## Immediate Priorities

1. Keep GKE as the canonical production path.
2. Maintain a dedicated ingestion worker deployment alongside the API.
3. Verify durable queue, GCS, and Redis settings after each rollout.
4. Expand readiness and release UX so governance becomes productized, not hidden in APIs.
5. Keep failure messaging stage-aware and operator-credible.
