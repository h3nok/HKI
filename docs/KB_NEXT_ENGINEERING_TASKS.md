# Knowledge Base — Next Engineering Tasks

**Created:** 2026-04-29
**Owner:** Platform Engineering
**Status:** Ready for assignment

Task specs for the next phase of Knowledge Base development. Each task has a defined starting point, numbered steps, and testable acceptance criteria. Tasks are ordered by priority.

---

## Task Index

| ID                                                                           | Title                                                   | Effort   | Priority |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- | -------- | -------- |
| [KB-1](#kb-1-wire-raptor-summarisation-into-the-ingestion-pipeline)          | Wire RAPTOR into the Ingestion Pipeline                 | 2–3 days | P0       |
| [KB-2](#kb-2-evaluation-loop--synthetic-qa--vertex-ai-judge--promotion-gate) | Evaluation Loop — Synthetic QA → Judge → Promotion Gate | 3 days   | P0       |
| [KB-3](#kb-3-activate-document-ai-ocr-for-scanned-pdfs)                      | Activate Document AI OCR for Scanned PDFs               | 1 day    | P1       |
| [KB-4](#kb-4-replace-neo4j-with-spanner-graph)                               | Replace Neo4j with Spanner Graph                        | 3–4 days | P1       |
| [KB-5a](#kb-5a-google-drive-connector)                                       | Google Drive Connector                                  | 3–4 days | P2       |
| [KB-5b](#kb-5b-url-crawl-connector)                                          | URL Crawl Connector                                     | 2–3 days | P2       |
| [KB-6](#kb-6-alloydb-ai-inline-embeddings)                                   | AlloyDB AI Inline Embeddings                            | 1 day    | P2       |

---

## KB-1: Wire RAPTOR Summarisation into the Ingestion Pipeline

**What it is:** RAPTOR builds a tree of cluster summaries over all chunks in an org. After any document is ingested, RAPTOR should run in the background so that broad questions hit summary nodes instead of only raw chunks. Without it, every query searches only raw chunks — broad questions ("What's our returns policy?") get poor recall.

**Starting files:**

- `apps/ai-platform/ingestion-pipeline-service/src/domain/raptor.py` — complete, do not modify
- `apps/ai-platform/ingestion-pipeline-service/src/domain/pipeline.py` — where the change goes
- `apps/ai-platform/ingestion-pipeline-service/k8s/configmap.yaml` — add flags here

### Steps

1. **Add config flags** to `services/ingestion-pipeline-service/k8s/configmap.yaml`:

   ```yaml
   RAPTOR_ENABLED: "true"
   RAPTOR_MAX_LEVELS: "3"
   ```

   In `services/ingestion-pipeline-service/src/core/config.py`, add the matching settings fields:

   ```python
   RAPTOR_ENABLED: bool = False
   RAPTOR_MAX_LEVELS: int = 3
   ```

2. **Inject `RaptorBuilder` into `IngestionPipeline`.** In `pipeline.py`, the `IngestionPipeline.__init__` currently takes `job_store, document_store, analytics`. Add an optional parameter:

   ```python
   def __init__(self, job_store, document_store, analytics, raptor_builder=None):
       self._raptor_builder = raptor_builder
   ```

   Wire it up wherever the pipeline is instantiated in `app.py`.

3. **Call RAPTOR after successful ingestion.** In `pipeline.py`, find `_run_shared_stages`. At the end, after the vector store call succeeds, add:

   ```python
   if self._raptor_builder and settings.RAPTOR_ENABLED:
       asyncio.create_task(
           self._raptor_builder.build(org_id=org_id, max_levels=settings.RAPTOR_MAX_LEVELS)
       )
   ```

   Use `asyncio.create_task` so it runs in the background and does not block the ingest response.

4. **Add `node_level` to the AlloyDB schema.** In `services/knowledge-api/src/adapters/alloydb_store.py`, find the schema migration SQL inside the `connect()` method. Add:

   ```sql
   ALTER TABLE chunks ADD COLUMN IF NOT EXISTS node_level INTEGER DEFAULT 0;
   ALTER TABLE chunks ADD COLUMN IF NOT EXISTS source_chunk_ids TEXT[] DEFAULT '{}';
   ```

   Level 0 = raw chunk. Level 1 = first-pass cluster summary. Level 2+ = higher summaries.

5. **Exclude summary nodes from standard search by default.** In `alloydb_store.py`, in `_vector_search()` and `_keyword_search()`, add `AND node_level = 0` to the WHERE clause. Add an optional `include_summary_nodes: bool = False` parameter that removes this filter when set to `True`.

6. **Write one pytest** in `services/ingestion-pipeline-service/tests/` that mocks `RaptorBuilder.build` and asserts it was called after a successful `ingest_text()`.

### Acceptance Criteria

- Ingesting a document triggers a background RAPTOR build for that org
- `RAPTOR_ENABLED: "false"` disables RAPTOR with no code path change
- A RAPTOR failure must not fail the ingest job — catch and log the exception
- Existing ingestion tests still pass

---

## KB-2: Evaluation Loop — Synthetic QA → Vertex AI Judge → Promotion Gate

**What it is:** After ingesting a document, auto-generate test questions from its chunks, retrieve answers, score them with the Vertex AI judge, and block promotion to `published` if the score is below threshold. Right now there is no way to know if a newly ingested document improves or degrades retrieval quality.

```
Ingest → Generate QA pairs → Retrieve answers → Judge → Gate promotion
```

**Starting files:**

- `apps/ai-platform/ingestion-pipeline-service/src/domain/synthesis.py` — `DatasetBuilder`, `QAGeneratorBackend` protocol — complete, do not modify
- `apps/ai-platform/knowledge-api/src/api/evaluation_routes.py` — `auto_evaluate` endpoint is the scoring path
- `apps/ai-platform/knowledge-api/src/domain/vertexai_judge.py` — `evaluate_batch(queries, responses, contexts, references)` is the judge call
- `apps/ai-platform/ingestion-pipeline-service/src/domain/pipeline.py` — promotion logic goes here

### Steps

1. **Add config flags** to `services/ingestion-pipeline-service/k8s/configmap.yaml`:

   ```yaml
   EVAL_ON_INGEST_ENABLED: "true"
   EVAL_PROMOTION_THRESHOLD: "0.65"
   EVAL_QUESTIONS_PER_DOC: "5"
   ```

   Add matching fields to `config.py`.

2. **Implement `GeminiQABackend`** in a new file `services/ingestion-pipeline-service/src/domain/qa_backend.py`. It must implement the `QAGeneratorBackend` protocol from `synthesis.py`:

   ```python
   class GeminiQABackend:
       def __init__(self, gemini_client): ...

       async def generate_qa(
           self,
           chunk_text: str,
           question_type: QuestionType,
           config: GenerationConfig,
       ) -> list[SyntheticQA]: ...
   ```

   Use the existing `GeminiClient` in `services/ingestion-pipeline-service/src/adapters/gemini_client.py`. Call Gemini with the prompt from `synthesis.build_generation_prompt()` and parse the response into `SyntheticQA` objects.

3. **Wire evaluation into the pipeline.** In `pipeline.py`, after `_send_to_vector_store` returns the stored chunks, add a new private method:

   ```python
   async def _evaluate_and_gate(
       self, chunks: list, org_id: str, document_id: str
   ) -> float:
   ```

   This method should:
   - Call `DatasetBuilder(backend).build(chunks[:20], config, name=document_id, org_id=org_id)` to generate QA pairs
   - For each QA pair, call `GET /v1/search?q={question}&org_id={org_id}` on the knowledge API to retrieve contexts
   - Collect `(question, retrieved_contexts, expected_answer)` triples
   - Call `judge.evaluate_batch(queries, responses, contexts, references)` from `VertexAIJudge`
   - Return the mean faithfulness score

4. **Gate document promotion.** In `_run_shared_stages`, after `_evaluate_and_gate` returns:
   - If score >= `EVAL_PROMOTION_THRESHOLD` → set document status to `published`
   - If score < threshold → set document status to `pending_review` and write the score into `document.metadata["eval_score"]`
   - If `EVAL_ON_INGEST_ENABLED: "false"` → skip entirely and promote as before

5. **Expose the score in the job status response.** In `IngestResponse`, add:

   ```python
   eval_score: float | None = None
   ```

   Populate it from job metadata when evaluation ran.

6. **Write two pytests:** one where score passes the gate (document promoted to `published`), one where it fails (document stays `pending_review`).

### Acceptance Criteria

- A freshly ingested document with score < 0.65 stays in `pending_review` status
- `GET /v1/jobs/{job_id}` response includes `eval_score`
- `EVAL_ON_INGEST_ENABLED: "false"` skips evaluation and promotes directly (existing behaviour)
- If the judge throws an exception, the ingest job must not fail — catch, log, and promote

---

## KB-3: Activate Document AI OCR for Scanned PDFs

**What it is:** The Document AI adapter is fully written. It just needs a GCP processor provisioned and the flag turned on. Without it, scanned PDFs (vendor contracts, printed forms, legacy docs) ingest as empty or near-empty chunks.

**Starting files:**

- `apps/ai-platform/ingestion-pipeline-service/src/adapters/document_ai.py` — `DocumentAIExtractor`, `create_document_extractor()` — complete, do not modify
- `apps/ai-platform/ingestion-pipeline-service/src/domain/pipeline.py` — `_extract_file()` — needs updating
- `apps/ai-platform/ingestion-pipeline-service/k8s/configmap.yaml` — add processor ID here

### Steps

1. **Provision the processor in GCP** (run once):

   ```bash
   gcloud documentai processors create \
     --location=us \
     --display-name="knowledge-pipeline-ocr" \
     --type=FORM_PARSER_PROCESSOR \
     --project=p-642-cilab-demo
   ```

   Copy the processor ID from the output — format: `projects/{number}/locations/us/processors/{id}`.

2. **Add config** to `configmap.yaml`:

   ```yaml
   DOCAI_ENABLED: "true"
   DOCAI_PROCESSOR_ID: "projects/783337976198/locations/us/processors/<id-from-step-1>"
   ```

   In `config.py`, add:

   ```python
   DOCAI_ENABLED: bool = False
   DOCAI_PROCESSOR_ID: str = ""
   ```

3. **Update `_extract_file()` in `pipeline.py`.** Replace direct `PyPDFExtractor` usage with the factory:

   ```python
   from src.adapters.document_ai import create_document_extractor

   async def _extract_file(self, file_bytes, filename, content_type):
       extractor = await create_document_extractor()
       if content_type == "application/pdf" or filename.endswith(".pdf"):
           return await extractor.extract_pdf(file_bytes, filename)
       elif content_type.startswith("image/"):
           return await extractor.extract_image(file_bytes, content_type, filename)
       # ... rest of existing logic
   ```

   `create_document_extractor()` already checks `settings.DOCAI_ENABLED` internally — no additional conditional needed.

4. **Grant the service account permission:**

   ```bash
   gcloud projects add-iam-policy-binding p-642-cilab-demo \
     --member="serviceAccount:knowledge-pipeline@p-642-cilab-demo.iam.gserviceaccount.com" \
     --role="roles/documentai.apiUser"
   ```

5. **Test with a real scanned PDF.** Upload a scanned PDF (image-only, no embedded text) via `POST /v1/ingest/file`. Confirm the resulting document has non-empty chunk content via `GET /v1/documents/{id}`.

### Acceptance Criteria

- A scanned PDF (image-only) ingests with readable, non-empty chunk content
- `DOCAI_ENABLED: "false"` falls back to PyPDF with no errors (existing behaviour unchanged)
- PDFs that already have embedded text continue to work correctly

---

## KB-4: Replace Neo4j with Spanner Graph

**What it is:** Neo4j is disabled in production (`NEO4J_URI: ""`). Entity extraction is fully designed and waiting for a graph backend. Spanner Graph is the GCP-native replacement — same GQL query language as Cypher, zero ops, production-grade.

**Starting files:**

- `apps/ai-platform/knowledge-api/src/adapters/neo4j_graph.py` — the interface to replicate
- `apps/ai-platform/knowledge-api/src/api/app.py` line ~162 — where `Neo4jKnowledgeGraph` is instantiated
- `apps/ai-platform/knowledge-api/k8s/configmap.yaml` — swap `NEO4J_URI` for Spanner config

### Steps

1. **Provision Spanner Graph** (coordinate with infra; run once):

   ```bash
   gcloud spanner instances create knowledge-graph \
     --config=regional-us-west1 \
     --description="Knowledge Graph" \
     --processing-units=100 \
     --project=p-642-cilab-demo

   gcloud spanner databases create knowledge \
     --instance=knowledge-graph \
     --project=p-642-cilab-demo
   ```

2. **Create `services/knowledge-api/src/adapters/spanner_graph.py`.** It must implement the same public interface as `neo4j_graph.py`:
   - `async connect(instance: str, database: str, project: str)` — create a Spanner client
   - `async close()` — close the client
   - `async store_entities(entities, relationships, org_id, document_id)` — upsert nodes and edges
   - `async get_neighbors(entity_name, max_depth, org_id)` — graph traversal query
   - `async hvsi_audit(org_id)` — return `{}` for now

   Use the `google-cloud-spanner` package. DDL for the graph schema:

   ```sql
   CREATE TABLE Entity (
     entity_id   STRING(MAX) NOT NULL,
     org_id      STRING(MAX) NOT NULL,
     name        STRING(MAX),
     entity_type STRING(MAX),
     properties  JSON,
     document_id STRING(MAX),
   ) PRIMARY KEY (org_id, entity_id);

   CREATE TABLE Relationship (
     relationship_id   STRING(MAX) NOT NULL,
     org_id            STRING(MAX) NOT NULL,
     source_id         STRING(MAX) NOT NULL,
     target_id         STRING(MAX) NOT NULL,
     relationship_type STRING(MAX),
   ) PRIMARY KEY (org_id, relationship_id);
   ```

3. **Update `app.py`** to import and instantiate `SpannerGraph` alongside the existing Neo4j block (~line 162):

   ```python
   if settings.SPANNER_INSTANCE:
       from src.adapters.spanner_graph import SpannerGraph
       graph = SpannerGraph()
       await graph.connect(
           settings.SPANNER_INSTANCE,
           settings.SPANNER_DATABASE,
           settings.GCP_PROJECT_ID,
       )
   ```

4. **Update `config.py`:**

   ```python
   SPANNER_INSTANCE: str = ""
   SPANNER_DATABASE: str = "knowledge"
   ```

5. **Update `configmap.yaml`** — replace the Neo4j block:

   ```yaml
   SPANNER_INSTANCE: "knowledge-graph"
   SPANNER_DATABASE: "knowledge"
   ENTITY_EXTRACTION_ENABLED: "true"
   ```

   Leave `NEO4J_URI: ""` in place — do not delete it. Both adapters coexist.

6. **Write one integration test** that stores two entities with a relationship, then calls `get_neighbors` and asserts both are returned.

### Acceptance Criteria

- `GET /v1/knowledge/graph/{chunk_id}` returns entity neighbours populated from Spanner
- `SPANNER_INSTANCE: ""` disables the graph (same no-op behaviour as empty `NEO4J_URI`)
- The Neo4j adapter and config are left untouched in the repo
- Entity extraction runs end-to-end on a newly ingested document

---

## KB-5a: Google Drive Connector

**What it is:** Add a sync endpoint that pulls files from a Google Drive folder and feeds them into the existing ingestion pipeline. The OAuth scaffolding is already wired in the agentic BFF (`GOOGLE_DRIVE_REDIRECT_URI` is set).

**Starting files:**

- `apps/ai-platform/ingestion-pipeline-service/src/domain/pipeline.py` — `ingest_file()` — call this per file
- `apps/ai-platform/agentic/k8s/configmap.yaml` line 33 — `GOOGLE_DRIVE_REDIRECT_URI` already configured
- Create: `services/ingestion-pipeline-service/src/adapters/gdrive_connector.py`
- Create: `services/ingestion-pipeline-service/src/api/connector_routes.py`

### Steps

1. **Create `gdrive_connector.py`:**

   ```python
   class GoogleDriveConnector:
       def __init__(self, oauth_token: str): ...

       async def list_files(self, folder_id: str) -> list[dict]:
           # Returns list of: { id, name, mimeType, modifiedTime }
           # Call: GET https://www.googleapis.com/drive/v3/files
           #        ?q='{folder_id}' in parents
           #        &fields=files(id,name,mimeType,modifiedTime)
           ...

       async def download_file(self, file_id: str) -> tuple[bytes, str]:
           # Returns (file_bytes, mime_type)
           # Call: GET https://www.googleapis.com/drive/v3/files/{id}?alt=media
           ...
   ```

   Use `httpx` (already a dependency). Pass `Authorization: Bearer {oauth_token}` on every request.

2. **Create `connector_routes.py`** with one endpoint:

   ```
   POST /v1/connectors/google-drive/sync
   Body: { folder_id, org_id, stream_id, department, tags }
   Header: Authorization: Bearer {google-oauth-token}
   ```

   For each file in the folder: download → call `pipeline.ingest_file()` → collect job IDs.
   Return: `{ synced: N, job_ids: [...] }`

3. **Register the router** in `services/ingestion-pipeline-service/src/api/app.py`.

4. **Add a proxy endpoint in the agentic BFF** that calls the above endpoint with the user's Google OAuth token from the existing BFF session. Coordinate with the agentic team for the token retrieval pattern already used in the Drive OAuth callback.

5. **Write one test** that mocks `GoogleDriveConnector.list_files` returning 3 files and asserts `pipeline.ingest_file` was called 3 times.

### Acceptance Criteria

- `POST /v1/connectors/google-drive/sync` with a valid folder ID and OAuth token ingests all supported files (PDF, DOCX, TXT)
- Unsupported file types are skipped and logged, not errored
- Response includes job IDs for all triggered ingestions

---

## KB-5b: URL Crawl Connector

**What it is:** Add a crawl endpoint that accepts a root URL, fetches reachable pages up to a configurable depth, and ingests each page as a document using the existing `ingest_url()` pipeline method.

**Starting files:**

- `apps/ai-platform/ingestion-pipeline-service/src/domain/pipeline.py` — `ingest_url()` — already implemented, just call it per URL
- Create: `services/ingestion-pipeline-service/src/adapters/url_crawler.py`
- Extend: `services/ingestion-pipeline-service/src/api/connector_routes.py` (from KB-5a, or create fresh)

### Steps

1. **Create `url_crawler.py`:**

   ```python
   class URLCrawler:
       def __init__(
           self,
           max_depth: int = 2,
           max_pages: int = 50,
           same_domain_only: bool = True,
       ): ...

       async def crawl(self, root_url: str) -> list[str]:
           # Returns list of discovered page URLs
   ```

   Use `httpx` to fetch pages. Parse `<a href>` links with Python's stdlib `html.parser`. Respect `same_domain_only` — never leave the root domain. Deduplicate URLs. Stop at `max_pages`.

2. **Add a crawl endpoint** in `connector_routes.py`:

   ```
   POST /v1/connectors/url/crawl
   Body: { root_url, org_id, stream_id, department, tags, max_depth, max_pages }
   ```

   For each discovered URL: call `pipeline.ingest_url(url, ...)`. Return all triggered job IDs.

3. **Rate-limit the crawler** — add a 500ms delay between page fetches to avoid hammering target servers:

   ```python
   await asyncio.sleep(0.5)
   ```

4. **Write two tests:** one asserting same-domain filtering works, one asserting `max_pages` cutoff is respected.

### Acceptance Criteria

- Crawling a root URL with `max_depth=2` ingests all linked pages within that domain up to `max_pages`
- Pages returning non-200 or non-HTML are skipped and logged, not errored
- `max_pages=0` disables the crawl — returns empty, no ingestion triggered

---

## KB-6: AlloyDB AI Inline Embeddings

**What it is:** Search currently makes two network round trips — embed the query via Vertex AI, then search AlloyDB. With the `google_ml_integration` extension, AlloyDB embeds the query internally in SQL, reducing this to one round trip.

**Starting files:**

- `apps/ai-platform/knowledge-api/src/adapters/alloydb_store.py` — `_vector_search()`, `connect()` (schema migration)
- `apps/ai-platform/knowledge-api/src/api/routes.py` — search handler that pre-embeds the query

### Steps

1. **Enable the extension on AlloyDB** (run once, requires AlloyDB access):

   ```sql
   CREATE EXTENSION IF NOT EXISTS google_ml_integration CASCADE;
   GRANT EXECUTE ON FUNCTION embedding TO PUBLIC;
   ```

   Then grant Vertex AI access to the AlloyDB service account:

   ```bash
   gcloud projects add-iam-policy-binding p-642-cilab-demo \
     --member="serviceAccount:service-783337976198@gcp-sa-alloydb.iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"
   ```

2. **Add a config flag** to `services/knowledge-api/k8s/configmap.yaml`:

   ```yaml
   ALLOYDB_INLINE_EMBEDDINGS: "true"
   ```

   Add to `config.py`:

   ```python
   ALLOYDB_INLINE_EMBEDDINGS: bool = False
   ```

3. **Update `_vector_search()` in `alloydb_store.py`.** Add an optional `raw_query: str | None = None` parameter. When `settings.ALLOYDB_INLINE_EMBEDDINGS` is `True` and `raw_query` is provided, replace the pre-computed embedding parameter with an inline call:

   ```sql
   -- Before:
   ORDER BY embedding <=> $1::vector

   -- After (when inline enabled):
   ORDER BY embedding <=> embedding('text-embedding-004', $1)::vector
   ```

   Pass `raw_query` as the `$1` parameter instead of the embedding array.

4. **Update the search route in `routes.py`.** When `ALLOYDB_INLINE_EMBEDDINGS=true`, skip the `await embedding_client.embed([query])` call and pass `raw_query=query` directly to `vector_store.search()`.

5. **Keep the existing path as fallback.** If `ALLOYDB_INLINE_EMBEDDINGS: "false"` (default), nothing changes — the pre-computed embedding is passed as before.

6. **Benchmark** — run 10 search queries with the flag on and off. Log `time_total` for each. The inline path should remove one ~50ms round trip per search.

### Acceptance Criteria

- Search returns identical results with the flag on and off (same documents, same order for the same query)
- `ALLOYDB_INLINE_EMBEDDINGS: "false"` keeps the existing code path 100% unchanged
- If the extension is not installed (e.g. local dev), the error is caught and the service falls back to pre-computed embeddings with a warning log

---

_Last updated: 2026-04-29. Update status column as tasks are picked up and completed._
