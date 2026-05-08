# Knowledge Base Testing & Maturity Guide

> Maintenance note: older sections in this guide may mention `make dev-mcp`. The current workspace entrypoint is `make -C .. dev-orchestrator` unless you are explicitly wiring a custom `MCP_SERVERS` configuration by hand.

**Purpose**: Systematic approach to test and mature the HKI knowledge base for production readiness.

---

## 🎯 Testing Philosophy

Knowledge base maturity is measured across **5 dimensions**:

1. **Retrieval Quality** — Does search return the right chunks?
2. **Answer Accuracy** — Are generated answers correct and grounded?
3. **Coverage** — Does the KB handle all common queries?
4. **Performance** — Are responses fast and reliable?
5. **Safety** — Are harmful/sensitive queries handled properly?

---

## 📊 Maturity Levels

| Level                    | Description                          | Metrics                 | Gate Criteria           |
| ------------------------ | ------------------------------------ | ----------------------- | ----------------------- |
| **L0: Baseline**         | MVP setup, basic search works        | N/A                     | Search returns results  |
| **L1: Functional**       | Core queries work, basic evaluation  | Context Relevance > 0.5 | 10 test cases pass      |
| **L2: Production-Ready** | Comprehensive coverage, reliable     | All metrics > 0.7       | 50 test cases, <2s p95  |
| **L3: Optimized**        | Tuned for precision, multi-hop       | All metrics > 0.85      | 100+ cases, <1s p95     |
| **L4: Advanced**         | Graph reasoning, continuous learning | All metrics > 0.9       | 200+ cases, auto-tuning |

**Goal**: Reach L2 (Production-Ready) before deployment, L3 within 3 months.

---

## 🚀 Quick Start Test Setup

### 1. Start All Services

```bash
# Terminal 1: Infrastructure (Redis, Postgres, Neo4j)
make infra-up

# Terminal 2: LiteLLM Gateway
docker restart hki-litellm

# Terminal 3: Knowledge API (with PostgreSQL backend)
cd apps/ai-platform/knowledge-api
ALLOYDB_URL=postgresql://postgres:postgres@localhost:9432/knowledge \
  uvicorn src.api.app:app --reload --port 9509

# Terminal 4: Knowledge Pipeline Service
cd apps/ai-platform/ingestion-pipeline-service
uvicorn src.api.app:app --reload --port 9508

# Terminal 5: Orchestrator with MCP (connects everything)
make dev-mcp
```

### 2. Seed Test Data

```bash
# Ingest test documents
cd test-data/kb-test-data

for file in *.md; do
  curl -X POST http://localhost:9508/v1/ingest/file \
    -F "file=@$file" \
    -F 'metadata={"department":"test","type":"sop"}' \
    -H "Authorization: Bearer test-token"
done
```

### 3. Run Evaluation Suite

```bash
# Option A: Via API (recommended)
curl -X POST http://localhost:9509/v1/evaluate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d @evaluation-suite.json \
  | python3 -m json.tool > evaluation-results.json

# Option B: Via Python test suite
cd apps/ai-platform/knowledge-api
pytest tests/test_evaluation.py -v --tb=short
```

---

## 📈 Key Metrics to Track

### A. Retrieval Metrics (RAGAS-based)

| Metric                 | Formula                           | Target | What it Measures                 |
| ---------------------- | --------------------------------- | ------ | -------------------------------- |
| **Context Relevance**  | avg(cosine_sim(query, chunks))    | > 0.7  | Are chunks semantically related? |
| **Context Precision**  | % of top-k above threshold        | > 0.75 | Is the ranking good?             |
| **Context Recall**     | % of ground-truth sentences found | > 0.8  | Did we find all relevant info?   |
| **Answer Similarity**  | cosine_sim(generated, expected)   | > 0.75 | Is the answer close to ideal?    |
| **Faithfulness**       | LLM judge: grounding score        | > 0.85 | No hallucinations?               |
| **Answer Correctness** | LLM judge: correctness score      | > 0.8  | Factually accurate?              |

### B. Performance Metrics

| Metric                   | Target          | Measurement                       |
| ------------------------ | --------------- | --------------------------------- |
| **Search Latency (p50)** | < 300ms         | Chrome DevTools, OpenTelemetry    |
| **Search Latency (p95)** | < 1000ms        | Percentile from trace data        |
| **Embedding Latency**    | < 200ms         | LiteLLM/Vertex AI trace           |
| **Index Size**           | Monitor growth  | PostgreSQL pg_total_relation_size |
| **Chunk Count**          | Track over time | `SELECT COUNT(*) FROM chunks`     |

### C. Coverage Metrics

```sql
-- Department coverage
SELECT department, COUNT(*) as doc_count
FROM documents
GROUP BY department;

-- Query intent coverage (track failed searches)
SELECT query, COUNT(*) as frequency
FROM search_logs
WHERE result_count = 0
GROUP BY query
ORDER BY frequency DESC
LIMIT 20;
```

---

## 🧪 Testing Workflow

### Phase 1: Unit Testing (Daily)

```bash
# Knowledge API tests
cd apps/ai-platform/knowledge-api
pytest tests/test_vector_store.py -v
pytest tests/test_evaluation.py -v
pytest tests/test_taxonomy.py -v

# Knowledge Pipeline tests
cd apps/ai-platform/ingestion-pipeline-service
pytest tests/test_pipeline.py -v
pytest tests/test_synthesis.py -v
```

### Phase 2: Integration Testing (Weekly)

```bash
# End-to-end ingest → search → evaluate
./tests/e2e_ingestion_test.sh

# Test via orchestrator (MCP path)
curl -X POST http://localhost:9501/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "What is the return policy for electronics?",
    "conversation_id": "eval-test",
    "user_id": "tester"
  }' | jq '.content, .citations'
```

### Phase 3: Evaluation Testing (Before Each Release)

```bash
# Run full evaluation suite
cd test-data/kb-test-data
python3 run_evaluation.py \
  --suite evaluation-suite.json \
  --output results-$(date +%Y%m%d).json \
  --threshold 0.7
```

### Phase 4: Load/Performance Testing (Monthly)

```bash
# Generate load
cd tools/gateway-evals
python3 load_test_knowledge.py \
  --queries 1000 \
  --concurrency 50 \
  --duration 300s
```

---

## 🔄 Continuous Improvement Loop

### Week 1-2: Baseline Establishment

- [ ] Ingest initial 50 documents across all departments
- [ ] Create 15-20 test cases (use `evaluation-suite.json`)
- [ ] Run baseline evaluation, record scores
- [ ] Document gaps and coverage holes

### Week 3-4: Coverage Expansion

- [ ] Add 100 more documents (employee handbooks, SOPs, policies)
- [ ] Expand test suite to 50 cases
- [ ] Run evaluation, track metric improvements
- [ ] Tune chunking strategy based on context_precision

### Month 2: Quality Tuning

- [ ] Implement multi-hop reasoning tests
- [ ] Enable Neo4j graph for entity linking
- [ ] Add department-specific test suites
- [ ] Optimize embedding model (test text-embedding-005 vs 004)
- [ ] Target: All metrics > 0.75

### Month 3: Production Hardening

- [ ] Add 200+ edge cases (contradictions, ambiguity, multi-intent)
- [ ] Enable drift detection (`embedding_drift.py`)
- [ ] Set up Cloud Monitoring and Cloud Trace for LLM call monitoring
- [ ] Load test at 100 QPS sustained
- [ ] Target: All metrics > 0.85, p95 < 1s

---

## 📝 Test Case Design Patterns

### 1. Basic Factual Recall

```json
{
  "query": "What is HKI's phone number?",
  "expected_answer": "1-800-774-2678",
  "difficulty": "basic",
  "dimensions": ["factual_recall"]
}
```

### 2. Multi-Step Procedure

```json
{
  "query": "How do I become an Executive member?",
  "expected_answer": "Visit the membership counter, provide valid ID, pay the $120 annual fee...",
  "difficulty": "intermediate",
  "dimensions": ["procedural", "multi_step"]
}
```

### 3. Edge Case / Contradictory

```json
{
  "query": "Can I return alcohol if I don't like it?",
  "expected_answer": "Alcohol returns vary by state law. In most states, alcohol cannot be returned once purchased...",
  "difficulty": "advanced",
  "dimensions": ["edge_case", "location_dependent"]
}
```

### 4. Temporal / Seasonal

```json
{
  "query": "When does the holiday hiring period start?",
  "expected_answer": "Seasonal hiring typically begins in October for the holiday season...",
  "difficulty": "intermediate",
  "dimensions": ["temporal", "hr_policy"]
}
```

---

## 🛠️ Debugging Poor Metrics

### Low Context Relevance (< 0.5)

**Cause**: Wrong chunks retrieved, poor embeddings

**Fix**:

```bash
# Test embedding quality
curl -X POST http://localhost:9509/v1/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test query", "mode": "vector", "top_k": 10}' \
  | jq '.results[] | {score, title, extract}'

# Try alternate chunking strategy
cd apps/ai-platform/ingestion-pipeline-service
# Edit: CHUNKING_STRATEGY=sliding_window (vs sentence)
```

### Low Faithfulness (< 0.7)

**Cause**: LLM hallucinating, insufficient context

**Fix**:

```python
# Increase context window
payload = {
  "query": "test",
  "top_k": 10,  # Increase from 5
  "mode": "hybrid"  # Use both vector + keyword
}
```

### Low Context Recall (< 0.6)

**Cause**: Missing chunks, poor BM25 indexing

**Fix**:

```sql
-- Rebuild tsvector index
ALTER TABLE chunks
  ALTER COLUMN content_tsvector
  SET (weight_factor = 1.0);

-- Update BM25 weight
-- In search code: BM25_WEIGHT=0.4 (increase from 0.3)
```

---

## 📦 Evaluation Output Format

```json
{
  "suite_name": "knowledge-base-core-evaluation",
  "total_cases": 15,
  "summary": {
    "context_relevance": 0.78,
    "context_precision": 0.82,
    "context_recall": 0.75,
    "answer_similarity": 0.81,
    "faithfulness": 0.88,
    "answer_correctness": 0.79
  },
  "statistics": {
    "context_relevance": {
      "mean": 0.78,
      "stddev": 0.12,
      "median": 0.81,
      "ci_lower": 0.72,
      "ci_upper": 0.84
    }
  },
  "case_results": [
    {
      "case_id": "return-policy-basic",
      "query": "What is HKI's return policy?",
      "metrics": [
        { "name": "context_relevance", "score": 0.92 },
        { "name": "faithfulness", "score": 0.95 }
      ]
    }
  ]
}
```

---

## 🎓 Best Practices

### ✅ DO

- Track metrics in Git (commit `evaluation-results-YYYYMMDD.json`)
- Run evaluations before merging knowledge changes
- Use representative test queries from real users
- Test across all departments and document types
- Monitor embedding drift monthly

### ❌ DON'T

- Optimize for test cases at the expense of real queries
- Ignore low-score outliers (they reveal gaps)
- Skip performance testing (it matters in production)
- Use only "easy" test cases
- Forget to version your test suite

---

## 🔗 Related Resources

- **Evaluation API**: [evaluation_routes.py](../src/api/evaluation_routes.py)
- **Metrics Implementation**: [evaluation.py](../src/domain/evaluation.py)
- **LLM Judge**: [llm_judge.py](../src/domain/llm_judge.py)
- **RAG Eval**: [rag_evaluation.py](../../ingestion-pipeline-service/src/domain/rag_evaluation.py)
- **Test Data**: [test-data/kb-test-data/](../kb-test-data/)

---

## 📞 Support

Questions? See the main [Knowledge API README](../README.md) or ping the platform team.
