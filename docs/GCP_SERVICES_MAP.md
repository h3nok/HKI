# GCP Services Map — AI Platform

> Written: 2026-04-28. Maps every platform component to its current or recommended GCP service.
> Sandbox project: p-642-cilab-sandbox. AI Platform API (Vertex AI) enabled.

---

## TL;DR — Where Things Stand

The platform is already significantly GCP-native. Several components you might assume are self-managed are actually on managed services. The gaps are: Neo4j (self-managed on GKE), and several Vertex AI services that are now unlocked since you enabled the AI Platform API.

---

## 1. What's Already GCP-Native

You're further along than the architecture doc implies. These are already running on managed GCP services in production:

| Component | GCP Service | Evidence |
|---|---|---|
| **BFF database (MySQL)** | **Cloud SQL for MySQL** | `cloud-sql-proxy` sidecar in `agentic/k8s/deployment.yaml`; instance `p-642-cilab-demo:us-west1:agentic-db` |
| **Vector store (PostgreSQL + pgvector)** | **AlloyDB** | PSC endpoint `10.1.0.6` (knowledge-api-db-psc-endpoint) — noted in `knowledge-api/k8s/deployment.yaml` |
| **Cache / memory / job state** | **Memorystore for Redis** | `REDIS_URL` patched from Terraform outputs at deploy time (`deploy-k8s.sh`) |
| **Container images** | **Artifact Registry** | `us-west1-docker.pkg.dev/p-642-cilab-infrastructure/cilab/` |
| **CI/CD** | **Cloud Build** | `cloudbuild.yaml` in every service |
| **Event queue** | **Cloud Pub/Sub** | Ingestion pipeline pub/sub emulated locally; real Pub/Sub in prod |
| **Document storage** | **Cloud Storage** | `gs://hki-knowledge-docs` |
| **Analytics warehouse** | **BigQuery** | Analytics service uses BigQuery in prod |
| **LLM (Gemini)** | **Vertex AI Model Garden** | LiteLLM routes `gemini-2.0-flash` + `text-embedding-004` → Vertex AI; project `p-642-cilab-infrastructure` |
| **Secret management** | **Secret Manager** | External-secrets-operator pattern; all service secrets annotated in deployment YAMLs |
| **HTTPS ingress + TLS** | **Cloud Load Balancing + Google-managed cert** | `agentic/k8s/ingress.yaml`; cert for `agentic.cilabs.np.hki.com` |
| **WAF** | **Cloud Armor** | `BackendConfig` in ingress references `agentic-waf` security policy — **needs the `gcloud` commands run to activate** |
| **LLM observability** | **Langfuse Cloud** | `VITE_LANGFUSE_URL: https://cloud.langfuse.com` in production configmap |
| **PII/DLP** | **Cloud DLP** | Configured in `litellm-gateway/config.yaml` `dlp_guardrail_config` — **callbacks disabled, needs one line to activate** |
| **Compute** | **GKE Standard** | `namespace: platform`; multi-zone topology spread on all deployments |

---

## 2. Vertex AI — What the AI Platform API Unlocks

Enabling `aiplatform.googleapis.com` gives you access to the full Vertex AI suite. Here's every service relevant to your platform:

### 2A. Agent Engine (formerly Reasoning Engine) — HIGHEST PRIORITY

Your orchestrator uses Google ADK, which is natively designed to deploy to **Vertex AI Agent Engine**. Today you run it as a self-managed FastAPI pod on GKE. With Agent Engine:

- ADK agents deploy as managed runtimes — no pod, no HPA, no Dockerfile management
- Built-in session management and memory persistence (replaces your 4-store Redis memory system)
- Native Vertex AI authentication (no `SERVICE_AUTH_SECRET`)
- Scales to zero and scales up automatically
- Integrated with Vertex AI Tracing and Evaluation

```python
# orchestrator-service/src/domain/agent.py — deploy like this instead of FastAPI pod:
from google.adk.agents import Agent
from vertexai.preview import reasoning_engines

agent = Agent(model="gemini-2.5-flash", ...)

app = reasoning_engines.AdkApp(agent=agent, enable_tracing=True)

# Deploy to Agent Engine:
remote_app = reasoning_engines.ReasoningEngine.create(
    app,
    requirements=["google-adk>=1.28.1", ...],
    display_name="AI Platform Orchestrator",
    project="p-642-cilab-sandbox",
    location="us-central1",
)
```

**What changes**: Orchestrator moves off GKE entirely. BFF calls Agent Engine's REST API instead of `http://orchestrator:9501`.

### 2B. Vertex AI RAG Engine — HIGH PRIORITY

You have a custom RAG implementation split across knowledge-api (retrieval) and ingestion-pipeline (chunking/embedding). Vertex AI RAG Engine is a managed service that handles:

- Document ingestion (PDF, DOCX, HTML, GCS URIs)
- Chunking (configurable size/overlap)
- Embedding via Vertex AI (`text-embedding-004` — same model you use)
- Hybrid retrieval (vector + keyword)
- Grounding results in your corpus

```python
# Could replace ingestion-pipeline + knowledge-api retrieval:
import vertexai
from vertexai.preview import rag

corpus = rag.create_corpus(display_name="hki-knowledge")
rag.import_files(corpus.name, paths=["gs://hki-knowledge-docs/"], ...)

# Retrieval (replaces MCP search_knowledge tool):
result = rag.retrieval_query(
    rag_resources=[rag.RagResource(rag_corpus=corpus.name)],
    text="What is the return policy?",
    similarity_top_k=5,
)
```

**Tradeoff**: RAG Engine is less customizable than your current stack (no RAPTOR clustering, no custom reranker, no LLM Judge). Keep your custom stack if evaluation quality matters; use RAG Engine for a simpler managed path or a second deployment.

### 2C. Vertex AI Vector Search (Matching Engine)

For scale beyond AlloyDB pgvector (billion+ vectors, <10ms ANN at scale). Your current AlloyDB pgvector is excellent for most enterprise workloads. Upgrade to Vector Search when:
- Collection exceeds ~10M vectors
- Latency target under 10ms at high QPS

Current pgvector on AlloyDB handles millions of vectors well. **Don't change this yet** unless you hit scale limits.

### 2D. AlloyDB AI — IMMEDIATE WIN (no migration needed)

AlloyDB already supports the `google_ml_integration` extension, which lets you call Vertex AI embedding models **inline in SQL**. You're already on AlloyDB — just enable the extension:

```sql
-- Enable once per AlloyDB instance:
CREATE EXTENSION IF NOT EXISTS google_ml_integration CASCADE;

-- Then embedding generation becomes a pure SQL operation:
SELECT
  chunk_id, content,
  embedding <=> google_ml.embedding('text-embedding-004', $1)::vector AS distance
FROM documents
ORDER BY distance ASC
LIMIT 10;
```

This eliminates the round-trip: ingestion-pipeline → LiteLLM gateway → Vertex AI → back. The AlloyDB instance calls Vertex AI directly. **Grant `vertex_user_ai_role` to the AlloyDB service account**.

### 2E. Vertex AI Evaluation Service

You have custom RAGAS-style evaluation in `knowledge-api/src/domain/evaluation.py` and `llm_judge.py`. Vertex AI Evaluation provides managed:

- Pointwise metrics (coherence, fluency, groundedness, instruction-following)
- Pairwise comparison between model versions
- Results stored in BigQuery automatically

```python
from vertexai.evaluation import EvalTask, MetricPromptTemplateExamples

eval_task = EvalTask(
    dataset=eval_dataset,
    metrics=[
        MetricPromptTemplateExamples.Pointwise.GROUNDEDNESS,
        MetricPromptTemplateExamples.Pointwise.INSTRUCTION_FOLLOWING,
    ],
)
result = eval_task.evaluate(model=your_model)
```

**Replace**: `knowledge-api/src/domain/llm_judge.py` — identical purpose, managed infrastructure.

### 2F. Gemini 2.5 Flash / Pro — Add to LiteLLM Config Now

Your `litellm-gateway/config.yaml` only has `gemini-2.0-flash`. Gemini 2.5 is a major quality leap — especially for agent reasoning and long-context retrieval:

```yaml
# Add to litellm-gateway/config.yaml model_list:
- model_name: gemini-2.5-flash
  litellm_params:
    model: vertex_ai/gemini-2.5-flash-preview-05-20
    vertex_project: os.environ/VERTEX_PROJECT
    vertex_location: us-central1

- model_name: gemini-2.5-pro
  litellm_params:
    model: vertex_ai/gemini-2.5-pro-preview-05-06
    vertex_project: os.environ/VERTEX_PROJECT
    vertex_location: us-central1
```

Then update orchestrator env: `AGENT_MODEL=gemini-2.5-flash`.

### 2G. Vertex AI Model Monitoring

Watches for embedding/prediction drift on your knowledge base over time. When your corpus is updated, embedding distribution can shift in ways that silently degrade retrieval quality.

- Integrates with your existing AlloyDB vector store
- Alerts via Cloud Monitoring when drift exceeds threshold
- Useful once the knowledge base is in steady-state production

---

## 3. Security Hardening — Activate What's Already Configured

### 3A. Cloud Armor WAF — One `gcloud` Command Away

The WAF is fully configured in `agentic/k8s/ingress.yaml` (BackendConfig references `agentic-waf`) but the security policy hasn't been created. Run the commands already documented in the ingress file header:

```bash
gcloud compute security-policies create agentic-waf \
  --description "OWASP ruleset for AI platform BFF"

# OWASP Top 10 rules:
gcloud compute security-policies rules create 1000 \
  --security-policy agentic-waf \
  --expression "evaluatePreconfiguredExpr('xss-stable')" \
  --action deny-403

gcloud compute security-policies rules create 1001 \
  --security-policy agentic-waf \
  --expression "evaluatePreconfiguredExpr('sqli-stable')" \
  --action deny-403

gcloud compute security-policies rules create 1002 \
  --security-policy agentic-waf \
  --expression "evaluatePreconfiguredExpr('rce-stable')" \
  --action deny-403

# Rate limiting (protect LLM endpoint):
gcloud compute security-policies rules create 9000 \
  --security-policy agentic-waf \
  --expression "true" \
  --action rate-based-ban \
  --rate-limit-threshold-count 100 \
  --rate-limit-threshold-interval-sec 60 \
  --ban-duration-sec 300
```

No code changes. No deployment. The GKE ingress will pick it up immediately.

### 3B. Cloud DLP — One Line to Activate

DLP is fully configured in `litellm-gateway/config.yaml` — project ID, info types, redaction rules. It's just not enabled in callbacks:

```yaml
# litellm-gateway/config.yaml — change:
# success_callback: ["langfuse"]
# failure_callback: ["langfuse"]

# To:
litellm_settings:
  callbacks: ["dlp_guardrail.dlp_guardrail", "langfuse"]
```

This activates PII detection (credit cards, SSN, email, phone, passport, driver's license) on every LLM request and response, with automatic redaction. The DLP API must be enabled in `p-642-cilab-infrastructure`.

### 3C. Workload Identity Federation — Replace `SERVICE_AUTH_SECRET`

Every service has a `ServiceAccount` K8s resource and a corresponding GCP service account (the pattern is in place). The current service-to-service auth uses a shared `SERVICE_AUTH_SECRET` JWT. Workload Identity eliminates this:

- GKE pods get automatic GCP identity via the K8s ServiceAccount binding
- Services verify callers by their GCP service account, not a shared secret
- No secrets to rotate; no `SERVICE_AUTH_SECRET` to leak

```bash
# Bind each K8s SA to its GCP SA (example for orchestrator):
gcloud iam service-accounts add-iam-policy-binding \
  orchestrator@p-642-cilab-infrastructure.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:p-642-cilab-infrastructure.svc.id.goog[platform/orchestrator]"
```

Then services use the metadata server token to call each other — no secret required.

---

## 4. Observability — Complete the Stack

### 4A. Managed Prometheus (GKE)

All pods already have `prometheus.io/scrape: "true"` annotations. GKE Autopilot and Standard both offer **Managed Service for Prometheus** — enable it once and all scrape annotations are collected automatically into Cloud Monitoring:

```bash
gcloud container clusters update YOUR_CLUSTER \
  --enable-managed-prometheus \
  --location us-west1
```

No Prometheus operator to manage. Metrics query via Cloud Monitoring's PromQL interface or Grafana with the Cloud Monitoring data source.

### 4B. Cloud Trace (OpenTelemetry)

All Python services already have OpenTelemetry configured in `shared/shared/tracing.py`. Route traces to Cloud Trace instead of (or alongside) Langfuse for the infrastructure view:

```python
# shared/shared/tracing.py — add Cloud Trace exporter:
from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter

tracer_provider.add_span_processor(
    BatchSpanProcessor(CloudTraceSpanExporter(project_id=GCP_PROJECT_ID))
)
```

Cloud Trace gives you flame graphs across all 5 services in the GCP Console without self-hosting anything.

### 4C. Cloud Deploy — Progressive Delivery

Current CI/CD: Cloud Build builds the image and pushes it. Add **Cloud Deploy** as the delivery layer between build and cluster:

```
Cloud Build → build image → push to Artifact Registry
                                      ↓
                              Cloud Deploy pipeline
                              ├── canary (5% traffic)
                              ├── stable (100% traffic)
                              └── rollback target
```

This gives you: canary releases, automated rollback on failed health checks, audit trail of every deploy.

---

## 5. Infrastructure Modernisation

### 5A. Replace Neo4j → Spanner Graph

Neo4j runs as a self-managed container on GKE (Community edition). **Spanner Graph** (GA as of 2024) is a fully managed graph database on GCP — same Cypher-like query language (GQL), global consistency, zero ops.

```sql
-- Spanner Graph DDL (replaces neo4j_graph.py schema):
CREATE PROPERTY GRAPH KnowledgeGraph
  NODE TABLES (Entity KEY (entity_id))
  EDGE TABLES (
    Relationship
      SOURCE KEY (source_id) REFERENCES Entity
      DESTINATION KEY (target_id) REFERENCES Entity
  );

-- Query (replaces neo4j session.run()):
GRAPH KnowledgeGraph
MATCH (e:Entity)-[:RELATED_TO*1..3]-(related:Entity)
WHERE e.entity_id = @entity_id
RETURN related.name, related.type;
```

**What changes**: `knowledge-api/src/adapters/neo4j_graph.py` → `spanner_graph.py`. Query syntax is GQL (similar to Cypher). No more Neo4j pod to manage, backup, or patch.

### 5B. Cloud Run Jobs — Ingestion Workers

The ingestion pipeline runs as a long-lived FastAPI pod that processes jobs from Pub/Sub. For batch document processing, **Cloud Run Jobs** is better:

- Scales to zero between ingestion jobs (no idle pod cost)
- Each document ingestion = one Job execution (triggered by Pub/Sub push)
- Automatic retries on failure
- No Kubernetes pod to manage for the worker component

Keep the FastAPI HTTP API pod for `/v1/ingest/text` and `/v1/jobs` endpoints. Move `src/worker.py` to Cloud Run Jobs.

### 5C. GKE Autopilot Migration

Current setup: GKE Standard (you manage node pools, machine types, node upgrades). **GKE Autopilot** removes all of that:

- No node pools to configure
- No VM SKUs to pick
- Automatic bin-packing and scaling
- Built-in security (no SSH to nodes, read-only node filesystems)
- Cost: pay per pod resource request, not per node

All existing K8s manifests (Deployment, Service, HPA, PDB) work unchanged on Autopilot. Migration path: create a new Autopilot cluster, run `kubectl apply` of existing manifests, cut over DNS.

---

## 6. Full Services Map (Current + Recommended)

| Platform Component | Current GCP Service | Recommended Next Step |
|---|---|---|
| **BFF database** | Cloud SQL for MySQL ✅ | — (already managed) |
| **Vector store** | AlloyDB via PSC ✅ | Enable `google_ml_integration` for inline Vertex AI embeddings |
| **Cache / memory** | Memorystore for Redis ✅ | — (already managed) |
| **CI/CD build** | Cloud Build ✅ | Add Cloud Deploy for progressive delivery |
| **Container registry** | Artifact Registry ✅ | — |
| **Event queue** | Cloud Pub/Sub ✅ | — |
| **Document storage** | Cloud Storage ✅ | — |
| **Analytics** | BigQuery ✅ | Add BigQuery ML for in-DB model scoring |
| **LLM routing** | Vertex AI via LiteLLM ✅ | Add Gemini 2.5 Flash/Pro to LiteLLM config |
| **HTTPS ingress** | Cloud Load Balancing + managed cert ✅ | — |
| **WAF** | Cloud Armor (configured, not active) ⚠️ | Run `gcloud` commands to create security policy |
| **PII protection** | Cloud DLP (configured, not active) ⚠️ | Enable callbacks in LiteLLM config |
| **Secrets** | Secret Manager ✅ | Wire Workload Identity to remove `SERVICE_AUTH_SECRET` |
| **LLM observability** | Langfuse Cloud ✅ | Add Cloud Trace exporter alongside Langfuse |
| **Metrics** | Prometheus annotations ✅ (scraping unclear) | Enable Managed Service for Prometheus on GKE |
| **Agent runtime** | Self-managed FastAPI on GKE | **Migrate to Vertex AI Agent Engine** |
| **RAG retrieval** | Custom knowledge-api + AlloyDB | Consider Vertex AI RAG Engine for simpler managed path |
| **LLM evaluation** | Custom RAGAS/LLM Judge | **Vertex AI Evaluation Service** |
| **Knowledge graph** | Neo4j self-managed on GKE ❌ | **Migrate to Spanner Graph** |
| **Ingestion workers** | Long-running FastAPI pod | **Migrate worker to Cloud Run Jobs** |
| **Cluster** | GKE Standard | Consider GKE Autopilot (drop-in, less ops) |
| **Delivery** | Cloud Build only | Add Cloud Deploy canary pipeline |

---

## 7. Priority Order (What to Do First)

### Immediate (no code change, configuration only)
1. **Activate Cloud Armor WAF** — `gcloud` commands already documented in `ingress.yaml`
2. **Enable Cloud DLP callbacks** — one line in `litellm-gateway/config.yaml`
3. **Add Gemini 2.5 Flash/Pro** — two entries in `litellm-gateway/config.yaml`
4. **Enable Managed Prometheus** — one `gcloud` command on the cluster
5. **Enable AlloyDB AI** — `CREATE EXTENSION google_ml_integration` on the AlloyDB instance

### Short-term (days of work, high ROI)
6. **Vertex AI Evaluation** — replace `llm_judge.py` with the managed evaluation SDK
7. **Cloud Trace exporter** — add to `shared/shared/tracing.py` (5 lines of code)
8. **Cloud Deploy pipeline** — add `clouddeploy.yaml` to each service; point Cloud Build at it

### Medium-term (architectural, weeks)
9. **Spanner Graph** — rewrite `neo4j_graph.py` as `spanner_graph.py`
10. **Cloud Run Jobs** for ingestion worker — extract `src/worker.py` from the pod
11. **Workload Identity** — remove `SERVICE_AUTH_SECRET` from all services
12. **Vertex AI Agent Engine** — redeploy orchestrator as Agent Engine app

### Longer-term (evaluate based on scale)
13. **GKE Autopilot migration** — when node management overhead becomes real
14. **Vertex AI RAG Engine** — evaluate against custom stack quality metrics
15. **Vertex AI Vector Search** — only when AlloyDB pgvector hits scale limits

---

*Update this document when services are migrated. Track activated vs planned in the Priority Order section.*
