#!/bin/bash
set -euo pipefail

# Knowledge Base Testing Environment Setup
# Starts all required services and seeds test data

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Knowledge Base Testing Environment Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# ─── Configuration ───────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
KB_API_URL="http://localhost:9509"
KB_PIPELINE_URL="http://localhost:9508"
ORCHESTRATOR_URL="http://localhost:9501"
LITELLM_URL="http://localhost:4000"

# ─── Functions ───────────────────────────────────────────────────

check_service() {
    local name="$1"
    local url="$2"

    echo -n "  Checking $name... "
    if curl -s -f "$url/health" > /dev/null 2>&1; then
        echo "✅ healthy"
        return 0
    else
        echo "❌ not responding"
        return 1
    fi
}

wait_for_service() {
    local name="$1"
    local url="$2"
    local max_wait=30
    local elapsed=0

    echo -n "  Waiting for $name"
    while [ $elapsed -lt $max_wait ]; do
        if curl -s -f "$url/health" > /dev/null 2>&1; then
            echo " ✅ ready (${elapsed}s)"
            return 0
        fi
        echo -n "."
        sleep 1
        elapsed=$((elapsed + 1))
    done

    echo " ❌ timeout after ${max_wait}s"
    return 1
}

# ─── Main Setup ──────────────────────────────────────────────────

echo "📦 Step 1: Check Infrastructure"
echo "────────────────────────────────────────────────────────────"
echo
echo "Services expected:"
echo "  • Redis          :9379"
echo "  • PostgreSQL     :9432"
echo "  • Neo4j          :9687"
echo "  • LiteLLM        :4000"
echo

# Check if infrastructure is running
if ! docker ps | grep -q "retail-agentic-redis"; then
    echo "⚠️  Infrastructure not running. Starting with 'make infra-up'..."
    cd "$REPO_ROOT"
    make infra-up
    sleep 5
else
    echo "✅ Infrastructure containers are running"
fi

echo

echo "📦 Step 2: Verify Core Services"
echo "────────────────────────────────────────────────────────────"
echo

# Check LiteLLM
if ! check_service "LiteLLM Gateway" "$LITELLM_URL"; then
    echo "  ⚠️  Starting LiteLLM..."
    docker restart retail-agentic-litellm || true
    wait_for_service "LiteLLM Gateway" "$LITELLM_URL" || {
        echo "  ❌ Failed to start LiteLLM. Exiting."
        exit 1
    }
fi

echo

echo "📦 Step 3: Start Knowledge Services"
echo "────────────────────────────────────────────────────────────"
echo

# Check knowledge-api
if ! check_service "knowledge-api" "$KB_API_URL"; then
    echo "  ⚠️  knowledge-api not running."
    echo "     Please start it manually in a separate terminal:"
    echo
    echo "     cd $REPO_ROOT/knowledge-api"
    echo "     ALLOYDB_URL=postgresql://postgres:postgres@localhost:9432/knowledge \\"
    echo "       uvicorn src.api.app:app --reload --port 9509"
    echo
    read -p "  Press ENTER when knowledge-api is running..."

    if ! wait_for_service "knowledge-api" "$KB_API_URL"; then
        echo "  ❌ knowledge-api still not accessible. Exiting."
        exit 1
    fi
fi

# Check knowledge-pipeline-service
if ! check_service "knowledge-pipeline" "$KB_PIPELINE_URL"; then
    echo "  ⚠️  knowledge-pipeline-service not running."
    echo "     Please start it manually in a separate terminal:"
    echo
    echo "     cd $REPO_ROOT/ingestion-pipeline-service"
    echo "     uvicorn src.api.app:app --reload --port 9508"
    echo
    read -p "  Press ENTER when knowledge-pipeline is running..."

    if ! wait_for_service "knowledge-pipeline" "$KB_PIPELINE_URL"; then
        echo "  ❌ knowledge-pipeline still not accessible. Exiting."
        exit 1
    fi
fi

# Check orchestrator
if ! check_service "orchestrator" "$ORCHESTRATOR_URL"; then
    echo "  ⚠️  orchestrator not running."
    echo "     Please start it manually in a separate terminal:"
    echo
    echo "     cd $REPO_ROOT"
    echo "     make dev-orchestrator"
    echo
    read -p "  Press ENTER when orchestrator is running..."

    if ! wait_for_service "orchestrator" "$ORCHESTRATOR_URL"; then
        echo "  ❌ orchestrator still not accessible. Exiting."
        exit 1
    fi
fi

echo

echo "📚 Step 4: Seed Test Data"
echo "────────────────────────────────────────────────────────────"
echo

cd "$SCRIPT_DIR"

# Count existing documents
DOC_COUNT=$(curl -s "$KB_API_URL/v1/documents?limit=1" \
    -H "Authorization: Bearer test-token" \
    | jq -r '.total // 0' 2>/dev/null || echo "0")

echo "  Current document count: $DOC_COUNT"

if [ "$DOC_COUNT" -gt 0 ]; then
    read -p "  Documents already exist. Re-ingest test data? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "  ⏭️  Skipping data ingestion"
        DOC_COUNT_AFTER=$DOC_COUNT
    else
        echo "  🔄 Ingesting test documents..."
        INGESTED=0
        for file in *.md; do
            [ -f "$file" ] || continue

            echo -n "    • $file... "

            RESPONSE=$(curl -s -w "\n%{http_code}" \
                -X POST "$KB_PIPELINE_URL/v1/ingest/text" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer test-token" \
                -d @- <<EOF
{
  "content": $(jq -Rs '.' < "$file"),
  "metadata": {
    "source_file": "$file",
    "department": "test",
    "document_type": "sop",
    "ingested_by": "test-setup-script"
  }
}
EOF
            )

            HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

            if [ "$HTTP_CODE" = "200" ]; then
                echo "✅"
                INGESTED=$((INGESTED + 1))
            else
                echo "❌ (HTTP $HTTP_CODE)"
            fi
        done

        echo
        echo "  ✅ Ingested $INGESTED documents"

        # Wait for indexing
        echo "  ⏳ Waiting for indexing to complete (5s)..."
        sleep 5

        DOC_COUNT_AFTER=$(curl -s "$KB_API_URL/v1/documents?limit=1" \
            -H "Authorization: Bearer test-token" \
            | jq -r '.total // 0' 2>/dev/null || echo "0")
    fi
else
    echo "  📥 No documents yet. Ingesting test data..."

    INGESTED=0
    for file in *.md; do
        [ -f "$file" ] || continue

        echo -n "    • $file... "

        RESPONSE=$(curl -s -w "\n%{http_code}" \
            -X POST "$KB_PIPELINE_URL/v1/ingest/text" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer test-token" \
            -d @- <<EOF
{
  "content": $(jq -Rs '.' < "$file"),
  "metadata": {
    "source_file": "$file",
    "department": "test",
    "document_type": "sop"
  }
}
EOF
        )

        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

        if [ "$HTTP_CODE" = "200" ]; then
            echo "✅"
            INGESTED=$((INGESTED + 1))
        else
            echo "❌ (HTTP $HTTP_CODE)"
        fi
    done

    echo
    echo "  ✅ Ingested $INGESTED documents"
    echo "  ⏳ Waiting for indexing (5s)..."
    sleep 5

    DOC_COUNT_AFTER=$(curl -s "$KB_API_URL/v1/documents?limit=1" \
        -H "Authorization: Bearer test-token" \
        | jq -r '.total // 0' 2>/dev/null || echo "0")
fi

echo "  📚 Total documents in KB: $DOC_COUNT_AFTER"
echo

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "🎯 Next Steps:"
echo
echo "  1. Run evaluation suite:"
echo "     cd $SCRIPT_DIR"
echo "     python3 run_evaluation.py"
echo
echo "  2. Test search via API:"
echo "     curl -X POST $KB_API_URL/v1/search \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -H 'Authorization: Bearer test-token' \\"
echo "       -d '{\"query\": \"return policy\", \"mode\": \"hybrid\", \"top_k\": 5}' | jq"
echo
echo "  3. Test via orchestrator:"
echo "     curl -X POST $ORCHESTRATOR_URL/v1/chat \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"message\": \"What is the return policy?\", \"conversation_id\": \"test\"}' | jq"
echo
echo "  4. View testing guide:"
echo "     cat $SCRIPT_DIR/TESTING_GUIDE.md"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
