# Hermetic Value Stream Isolation (HVSI)

## Purpose

Hermetic Value Stream Isolation is the target security and runtime model for the HKI knowledge retrieval.

"Hermetic" means sealed: no cross-stream bleed, no implicit org-global knowledge, no wildcard runtime reads, and no storage records that become visible outside their assigned stream by accident.

This document defines what "complete isolation" means for the knowledge base and the agent platform.

## Decision Summary

We are standardizing on Hermetic Value Stream Isolation (HVSI).

Under HVSI:

1. Every runtime knowledge artifact belongs to exactly one value stream.
2. Every runtime request executes against exactly one value stream.
3. Shared enterprise knowledge is distributed by explicit replication or publication, never by null-stream fallback.
4. Admin visibility across streams is allowed only in dedicated admin workflows, not by weakening runtime isolation.

## Why This Is Needed

The current platform already has strong stream-aware controls in the BFF and chat layers, but the downstream knowledge model still contains legacy org-global behavior.

Current examples of non-hermetic behavior:

1. The knowledge API protocol still allows `stream_id IS NULL` to be visible to scoped callers.
2. AlloyDB filtering treats null-stream documents as org-global.
3. Neo4j graph traversal treats null-stream chunks as org-global.
4. Ingestion job models and some API contracts still describe `stream_id = null` as globally accessible.

That model is incompatible with the user's requirement of complete end-to-end isolation.

## Hard Invariants

These are the non-negotiable rules for HVSI.

### 1. One Artifact, One Stream

Every runtime artifact must carry a non-null `stream_id`.

This applies to:

1. documents
2. chunks
3. graph nodes and graph edges derived from documents
4. ingestion jobs
5. review records
6. connectors and connector sync runs
7. launch-readiness snapshots, eval runs, releases, and attestations
8. contribution events and stream-scoped leaderboard aggregates
9. cache entries, trace events, and audit events where scope matters

### 2. One Request, One Active Stream

Every runtime knowledge request must resolve to exactly one stream.

This applies to:

1. chat retrieval
2. manual ingest
3. connector onboarding
4. connector sync
5. document listing and document detail
6. review queues
7. launch readiness
8. evaluation and release workflows

Multi-stream access is an authorization property of the user, not a retrieval mode of the request.

### 3. No Implicit Global Runtime Scope

The current sentinel meaning of `global` must not remain a wildcard bypass in runtime knowledge flows.

Allowed target states:

1. Replace `global` with a normal stream such as `enterprise` or `employee-copilot`.
2. Keep the literal ID `global`, but only as a normal stream identifier with no bypass semantics.

Disallowed target state:

1. `global` meaning "skip stream filtering".

### 4. No Null-Stream Fallback

Runtime reads must never include clauses equivalent to:

```sql
stream_id IS NULL OR stream_id IN (...)
```

Runtime writes must never intentionally persist null `stream_id` values.

### 5. Fail Closed

If the selected stream is missing, ambiguous, or unauthorized, the request fails.

No request may silently fall back to:

1. the first assigned stream
2. org-global scope
3. an unrestricted admin view

During migration we may temporarily derive the stream from a persisted conversation or connector, but the persisted artifact still has to be explicit and singular.

### 6. Shared Knowledge Uses Replication, Not Shared Visibility

If the same policy document needs to appear in Pharmacy and Optical, it must exist as two published stream-specific artifacts or as a single source fan-out process that materializes stream-specific copies.

HVSI does not allow one shared runtime record to be visible across streams.

## Boundary Model

HVSI separates the platform into two planes.

### Runtime Plane

The runtime plane is hermetic. It includes:

1. chat retrieval
2. KB self-service
3. ingestion
4. connector sync
5. review
6. evaluation
7. release and readiness
8. knowledge analytics that influence operator action inside a stream

Runtime-plane APIs always execute inside one stream.

### Admin Plane

The admin plane may inspect multiple streams, but it does so explicitly.

Examples:

1. stream inventory dashboards
2. migration inventory reports
3. admin-only audit exports
4. cross-stream rollout monitoring

Admin-plane access must never be implemented by weakening downstream runtime filters.
It should aggregate multiple stream-scoped reads or use dedicated admin-only queries that are not reused by runtime APIs.

## Target Architecture

### Agentic BFF

The BFF becomes the stream-selection gate.

Rules:

1. Every KB mutation requires an explicit `streamId`.
2. Every KB read executes with an explicit selected stream.
3. Connector records carry a first-class stream identity.
4. `defaultToFirstScoped` is transitional only and must be removed from runtime entry points once the UI always sends a stream.
5. Downstream service JWTs carry a single active stream for runtime calls.

Recommended changes:

1. Promote connector stream from JSON config into a dedicated DB column.
2. Promote connector sync rows to include `streamId` directly.
3. Add a strict-mode feature flag such as `KB_HERMETIC_ISOLATION=true` during rollout.

### Ingestion Pipeline

The pipeline must stop modeling null-stream jobs as globally accessible.

Rules:

1. `IngestionJob.stream_id` becomes required for runtime ingest.
2. Review records inherit the same non-null stream requirement.
3. Queue payloads always include `stream_id`.
4. Reprocess and refresh operations preserve the original stream.

Recommended changes:

1. Reject runtime ingest requests that omit `stream_id`.
2. Backfill or delete legacy null-stream jobs before enabling strict constraints.
3. Update API documentation and OpenAPI descriptions to remove "globally accessible" semantics.

### Knowledge API

The knowledge API becomes strictly single-stream for runtime requests.

Rules:

1. Runtime `allowed_streams` must resolve to exactly one stream.
2. Query logic must use exact-match stream filters.
3. Protocol comments and type contracts must no longer describe null-stream visibility.
4. Admin or migration tooling, if needed, must use separate code paths.

Recommended changes:

1. Replace any `stream_id IS NULL OR ...` logic with exact stream predicates.
2. Make `stream_id` non-null in persisted document and chunk metadata.
3. Add storage audits that fail startup or health checks if null-stream data exists while strict mode is enabled.

### AlloyDB and Graph Storage

Storage is part of the security boundary.

Rules:

1. Documents and chunks must store `stream_id` as a required field.
2. Graph nodes and edges derived from documents must retain the same stream.
3. Search indexes and graph traversals filter by exact stream.

Recommended changes:

1. Move stream identity from loosely structured metadata into a dedicated column where practical.
2. Add `NOT NULL` constraints after backfill.
3. Add composite indexes keyed by `org_id, stream_id` for documents, chunks, and graph traversal helpers.

### Orchestrator

The orchestrator already behaves close to the target model, but HVSI makes the contract explicit.

Rules:

1. A conversation is pinned to one stream.
2. Retrieval calls propagate the conversation stream exactly.
3. Tool calls that interact with the KB must execute within the same stream.
4. Corrective RAG never broadens the stream scope when rewriting a query.

### Shared Knowledge Publication

HVSI still allows enterprise-wide content, but not through shared runtime records.

The approved pattern is publish-and-replicate.

Flow:

1. Author a source once in a publication workspace.
2. Approve a target stream list.
3. Materialize one stream-specific published artifact per target stream.
4. Track lineage so updates can fan out deterministically.

This gives us reuse without bleed.

## Migration Plan

### Wave 0: Declare the Contract

1. Adopt HVSI as the named target architecture.
2. Freeze new uses of null-stream runtime data.
3. Update docs and API comments to mark legacy null-stream behavior as deprecated.

### Wave 1: Stop New Leakage

1. Require explicit stream selection in the KB UI and connector flows.
2. Require runtime ingest APIs to receive a stream.
3. Require downstream JWTs to carry a single active stream.
4. Remove runtime code paths that widen scope because `global` is present.

### Wave 2: Inventory Legacy Data

Build reports for:

1. documents with null `stream_id`
2. chunks with null `stream_id`
3. graph nodes and edges reachable only through null-stream chunks
4. ingestion jobs and review records with null `stream_id`
5. connectors with missing or invalid stream mapping
6. contribution rows without a stream

### Wave 3: Backfill or Replicate

For each legacy artifact choose one action:

1. assign to a single owning stream
2. replicate into multiple target streams
3. move into a dedicated enterprise stream
4. archive or delete if ownership is unclear

### Wave 4: Enforce Constraints

1. Add `NOT NULL` constraints for runtime stream identity.
2. Remove `IS NULL` read-path allowances.
3. Remove wildcard `global` runtime behavior.
4. Add startup or CI checks that fail if legacy semantics reappear.

### Wave 5: Prove It

1. Add end-to-end isolation tests across BFF, pipeline, knowledge API, graph, and orchestrator.
2. Add regression tests that specifically attempt cross-stream bleed.
3. Add migration guard dashboards for null-stream counts and strict-mode violations.

## Required Backlog by Component

### Knowledge API

Primary targets:

1. `services/knowledge-api/src/domain/protocols.py`
2. `services/knowledge-api/src/adapters/vector_store.py`
3. `services/knowledge-api/src/adapters/alloydb_store.py`
4. `services/knowledge-api/src/adapters/neo4j_graph.py`
5. `services/knowledge-api/src/api/internal_routes.py`
6. `services/knowledge-api/src/api/routes.py`

### Ingestion Pipeline

Primary targets:

1. `services/ingestion-pipeline-service/src/domain/models.py`
2. `services/ingestion-pipeline-service/src/domain/queue_messages.py`
3. `services/ingestion-pipeline-service/src/api/routes.py`
4. `services/ingestion-pipeline-service/src/api/review_routes.py`

### Agentic BFF and UI

Primary targets:

1. `agentic/server/_core/value-stream-access.ts`
2. `agentic/server/service-client.ts`
3. `agentic/server/connectors.ts`
4. `agentic/server/knowledge.ts`
5. `agentic/server/gamification/index.ts`
6. `agentic/client/src/pages/knowledge/**`

### Schema and Analytics

Primary targets:

1. first-class connector `streamId`
2. stream-scoped sync history
3. stream-scoped contribution aggregates
4. stream-scoped leaderboard materialization
5. stream-aware cache keys and observability tags

## Acceptance Criteria

HVSI is complete only when all of these are true:

1. No runtime query returns artifacts from another stream.
2. No runtime query returns a null-stream artifact.
3. No runtime write can create a null-stream artifact.
4. The `global` sentinel no longer bypasses runtime filtering.
5. Cross-stream admin visibility exists only in explicit admin flows.
6. Shared enterprise content is delivered by publication and replication, not by fallback visibility.
7. The test suite includes negative tests for cross-stream bleed in every service boundary.

## Non-Goals

HVSI does not require:

1. one database per stream
2. one service deployment per stream
3. removing admin-only cross-stream reporting

HVSI is a runtime isolation guarantee, not a mandate for physical infrastructure sharding.

## Recommended Next Implementation Order

1. Remove null-stream read semantics from the knowledge API and graph adapters.
2. Make ingestion and review records require explicit stream identity.
3. Replace wildcard `global` runtime behavior with explicit stream behavior.
4. Promote connector stream identity into first-class schema.
5. Introduce publication-and-replication for enterprise-wide content.
6. Add stream-scoped leaderboard/profile aggregates.

## Working Definition

If a Pharmacy manager opens the Pharmacy KB, every artifact they can ingest, search, review, evaluate, release, score, or sync must already be stamped Pharmacy.

Nothing becomes visible because it was left unscoped.
Nothing becomes visible because a service treated `global` as a wildcard.
Nothing becomes visible because another stream happened to exist in the same org.

That is Hermetic Value Stream Isolation.
