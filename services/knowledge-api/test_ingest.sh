#!/bin/bash
set -e

# Knowledge API Test - Ingest and Search
# This script demonstrates ingesting documents and searching them.
# For GKE access, port-forward knowledge-api locally first:
# kubectl -n platform port-forward svc/knowledge-api 9509:9509

SERVICE_URL="${SERVICE_URL:-http://127.0.0.1:9509}"
GCP_PROJECT="${GCP_PROJECT:-p-642-cilab-demo}"
SERVICE_AUTH_SECRET=$(gcloud secrets versions access latest --secret=knowledge-api-service-auth-secret --project="$GCP_PROJECT")

b64url() {
    openssl base64 -A | tr '/+' '_-' | tr -d '='
}

echo "🔑 Generating JWT token..."
# Generate a simple JWT for testing (org_id: default, role: operator)
# In production, this comes from the BFF after Google SSO login
JWT_PAYLOAD=$(printf '{"iss":"agentic-bff","aud":"internal-services","org_id":"default","sub":"test-user","role":"operator","exp":%s}' "$(( $(date +%s) + 3600 ))" | b64url)
JWT_HEADER=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
JWT_SIGNATURE=$(printf '%s' "${JWT_HEADER}.${JWT_PAYLOAD}" | openssl dgst -sha256 -hmac "$SERVICE_AUTH_SECRET" -binary | openssl base64 -A | tr '/+' '_-' | tr -d '=')
JWT_TOKEN="${JWT_HEADER}.${JWT_PAYLOAD}.${JWT_SIGNATURE}"

echo "✅ Token generated"
echo ""

# Function to ingest a document
ingest_doc() {
    local file=$1
    local title=$(basename "$file" .md)
    local doc_type=${2:-general}

    echo "📄 Ingesting: $title"

    content=$(cat "$file" | jq -Rs .)

    response=$(curl -s -X POST "${SERVICE_URL}/v1/ingest" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${JWT_TOKEN}" \
        -d "{
            \"content\": ${content},
            \"metadata\": {
                \"title\": \"${title}\",
                \"document_type\": \"${doc_type}\",
                \"author\": \"Test Script\",
                \"department\": \"Engineering\"
            }
        }")

    doc_id=$(echo "$response" | jq -r '.document_id // empty')
    status=$(echo "$response" | jq -r '.status // empty')
    chunk_count=$(echo "$response" | jq -r '.chunk_count // 0')

    if [ -n "$doc_id" ]; then
        echo "   ✅ Document ID: $doc_id"
        echo "   📊 Status: $status, Chunks: $chunk_count"
    else
        echo "   ❌ Failed to ingest"
        echo "$response" | jq .
    fi
    echo ""
}

# Function to search
search() {
    local query=$1
    echo "🔍 Searching: \"$query\""

    response=$(curl -s -X POST "${SERVICE_URL}/v1/search" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${JWT_TOKEN}" \
        -d "{
            \"query\": \"${query}\",
            \"k\": 3,
            \"strategy\": \"hybrid\"
        }")

    echo "$response" | jq '{
        query: .query,
        result_count: .results | length,
        results: [.results[] | {
            score: .score,
            title: .citation.document_title,
            excerpt: .citation.content_preview
        }]
    }'
    echo ""
}

# Ingest some documents
echo "📚 Ingesting documents from test-data..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/test-data"

ingest_doc "controlled-substance-policy.md" "policy"
ingest_doc "prescription-fulfillment-sop.md" "sop"
ingest_doc "immunization-program.md" "policy"

echo "🔍 Testing search..."
echo ""

search "How do we handle controlled substances?"
search "What are the immunization requirements?"
search "prescription fulfillment process"

echo "📊 Getting stats..."
curl -s -X GET "${SERVICE_URL}/v1/stats" \
    -H "Authorization: Bearer ${JWT_TOKEN}" | jq .

echo ""
echo "✅ Test complete!"
