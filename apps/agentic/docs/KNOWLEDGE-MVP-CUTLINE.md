# Knowledge KB MVP Cutline

> **Status**: Proposed
> **Date**: April 2026
> **Builds on**: HERMETIC-VALUE-STREAM-ISOLATION.md, KNOWLEDGE-SELF-SERVICE-DESIGN.md, KNOWLEDGE-VALIDATION-AND-PATTERNS.md, FEATURE-LOCKING-AND-FLAGS.md

---

## 1. Decision

The current Knowledge Base is a strong beta and design direction, but it is too broad to treat as a clean MVP without a tighter cutline.

The MVP should be a **curated D2K pilot** with one explicit stream, one review path, and one retrieval test path.

Do not treat the following as MVP requirements:

1. cross-stream or implicit `global` runtime behavior
2. connectors
3. URL crawl
4. text paste
5. contradiction detection
6. shadow index before/after preview
7. adaptive RAG, CRAG, RAPTOR, or graph community summarization
8. broad governance and compliance surfaces

## 2. MVP Definition

The KB MVP is successful when a stream manager can do the following without platform engineering help:

1. open a KB workspace that is pinned to one value stream
2. upload a file into that stream
3. see basic quality and PII signals before submission
4. submit the document into a review queue
5. approve and publish the document
6. ask a test question against the published KB and inspect citations
7. verify job and document status from the workspace

This is the only gold path required for pilot launch.

## 3. In Scope For MVP

### Product scope

1. Overview
2. Ingest
3. Library
4. Review queue
5. Test sandbox
6. Pipeline job visibility

### Ingestion scope

1. file upload only
2. stream-scoped metadata
3. quality scoring
4. PII scan and redaction
5. submit for review
6. publish after approval

### Retrieval scope

1. exact single-stream execution
2. hybrid search
3. citations
4. pending-vs-published lifecycle enforcement

## 4. Explicitly Out Of Scope

These should stay dark for MVP rollout:

1. connectors and Google Drive sync
2. URL crawl and text paste
3. collections management as a primary workflow
4. taxonomy and graph views
5. eval suite generation
6. gap analysis as a launch dependency
7. users/access and compliance panels
8. contradiction detection
9. shadow index before/after comparison
10. advanced orchestration patterns marketed as core KB capability

## 5. Non-Negotiable Constraints

These are required before calling the KB pilot-grade:

1. Every runtime KB request resolves to exactly one stream.
2. Missing or ambiguous stream selection fails closed.
3. Runtime KB flows do not widen to `global`.
4. Runtime artifacts do not persist null `stream_id` values.
5. `stream_id` is the primary isolation boundary. Department and tag filters are secondary retrieval hints, not the security model.
6. Pending review content is hidden from normal retrieval and only exposed in explicit test/review flows.

## 6. Rollout Presets

Use two rollout postures:

### `mvp.first`

Use this as the safest shell rollout:

1. overview, ingest, library, pipelines, and activity enabled
2. file upload enabled
3. validate and govern surfaces disabled
4. connectors and alternate ingest modes disabled

This is appropriate when the team wants to validate onboarding, upload, and library behavior without exposing curation and answer testing yet.

### `mvp.curated`

Use this as the actual curated KB pilot:

1. chat prompt generation, rerun, and backend thumbs feedback stay enabled
2. chat attachments and voice stay disabled
3. clear-all tasks stays debug-only
4. overview, ingest, library, validate, govern, and activity enabled
5. file upload enabled
6. validate limited to test sandbox, quality, and eval suites
7. govern limited to review queue
8. collections, taxonomy, graph, connectors, URL crawl, text paste, gaps, user access, and compliance disabled

This is the recommended preset for first real manager adoption.

## 7. Prioritized Backlog

### P0: Required before pilot

1. Remove KB runtime fallback behavior that defaults to first-scoped or `global`.
2. Remove KB search auto-routing for ambiguous multi-stream queries. Require explicit stream selection.
3. Make HVSI audits operational gates, not just reports. Null-stream documents and chunks should block strict rollout.
4. Treat `stream_id` as the authoritative scope in docs, code comments, and API contracts.
5. Align the docs with reality by separating shipped capabilities from design-only capabilities.
6. Launch with the `mvp.curated` preset rather than enabling the full knowledge surface.

### P1: Immediate post-pilot improvements

1. Add contradiction detection for review triage.
2. Add a before/after test mode backed by a true shadow index.
3. Add freshness policy and review SLA indicators.
4. Expand the curated evaluation suite coverage for regression testing by stream.
5. Add basic publication lineage so replacements and refreshes are traceable.

### P2: Expansion work

1. connectors
2. URL crawl
3. text paste
4. collections authoring
5. taxonomy and graph exploration
6. gap analysis as a managed workflow
7. multi-step retrieval patterns such as CRAG and adaptive RAG

## 8. Pilot Exit Criteria

The MVP is ready for broader rollout when all of the following are true:

1. a manager can complete the gold path without operator intervention
2. retrieval remains stream-correct under explicit HVSI tests
3. pending-review content does not leak into normal search
4. pilot users can identify why a document was blocked, reviewed, published, or stale
5. the team can measure ingestion success, publish throughput, and test query quality for at least one live stream

## 9. Practical Rule

If a feature does not directly improve the curated gold path for one stream manager, it is not MVP work.

## 10. Next Document

For the path from curated MVP to full-scope beta and enterprise rollout, see `KNOWLEDGE-FULL-SCOPE-EXECUTION-PLAN.md`.
