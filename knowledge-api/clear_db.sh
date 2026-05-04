#!/bin/bash
set -e

# Clear Database - Delete all documents from knowledge-api
# This removes all documents and their chunks for the default org.
# For GKE access, port-forward knowledge-api locally first:
# kubectl -n platform port-forward svc/knowledge-api 9509:9509

SERVICE_URL="${SERVICE_URL:-http://127.0.0.1:9509}"
GCP_PROJECT="${GCP_PROJECT:-p-642-cilab-demo}"
SERVICE_AUTH_SECRET=$(gcloud secrets versions access latest --secret=knowledge-api-service-auth-secret --project="$GCP_PROJECT")

b64url() {
    openssl base64 -A | tr '/+' '_-' | tr -d '='
}

echo "🔑 Generating JWT token..."
JWT_PAYLOAD=$(printf '{"iss":"agentic-bff","aud":"internal-services","org_id":"default","sub":"test-user","role":"operator","exp":%s}' "$(( $(date +%s) + 3600 ))" | b64url)
JWT_HEADER=$(printf '{"alg":"HS256","typ":"JWT"}' | b64url)
JWT_SIGNATURE=$(printf '%s' "${JWT_HEADER}.${JWT_PAYLOAD}" | openssl dgst -sha256 -hmac "$SERVICE_AUTH_SECRET" -binary | openssl base64 -A | tr '/+' '_-' | tr -d '=')
JWT_TOKEN="${JWT_HEADER}.${JWT_PAYLOAD}.${JWT_SIGNATURE}"

echo "✅ Token generated"
echo ""

echo "📋 Fetching all documents..."
docs=$(curl -s -X GET "${SERVICE_URL}/v1/documents" \
    -H "Authorization: Bearer ${JWT_TOKEN}")

doc_ids=$(echo "$docs" | jq -r '.documents[]?.id // empty')

if [ -z "$doc_ids" ]; then
    echo "✅ No documents to delete"
    exit 0
fi

count=$(echo "$doc_ids" | wc -l)
echo "🗑️  Found $count documents to delete"
echo ""

for doc_id in $doc_ids; do
    echo "   Deleting: $doc_id"
    curl -s -X DELETE "${SERVICE_URL}/v1/documents/${doc_id}" \
        -H "Authorization: Bearer ${JWT_TOKEN}" > /dev/null
done

echo ""
echo "✅ Database cleared!"
echo ""

echo "📊 Final stats:"
curl -s -X GET "${SERVICE_URL}/v1/stats" \
    -H "Authorization: Bearer ${JWT_TOKEN}" | jq .
