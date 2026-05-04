# AI Gateway Integration (Minimal)

Use this if your team only needs to integrate quickly.

## 1) Use these URLs

- API base (backend calls): `https://ai-gateway-674116041377.us-west1.run.app/v1`
- UI (browser only): `https://aigateway.cilabs.np.hki.com/ui/`


## 2) Use these models

- Chat / orchestration: `gemini-2.0-flash`
- Embeddings: `text-embedding-004`
- Avoid relying on alias: `gemini-3-pro` (alias mapping may change)
- Fallback rule: if configured model fails with `400`/`404`, retry with `gemini-2.0-flash`

## 3) Required env vars

```env
LLM_GATEWAY_URL=https://ai-gateway-674116041377.us-west1.run.app/v1
LLM_API_KEY=sk-<scoped-key>

EMBEDDING_GATEWAY_URL=https://ai-gateway-674116041377.us-west1.run.app/v1
EMBEDDING_API_KEY=sk-<scoped-key>
```

## 4) Create scoped key (recommended)

```bash
MASTER_KEY="$(gcloud secrets versions access latest \
  --secret=ai-gateway-master-key \
  --project=p-642-cilab-infrastructure)"

curl -sS -X POST "https://ai-gateway-674116041377.us-west1.run.app/key/generate" \
  -H "Authorization: Bearer $MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "models": ["gemini-2.0-flash", "text-embedding-004"],
    "duration": "30d",
    "max_budget": 25
  }'
```

Use returned `key` (`sk-...`) in env vars above.

## 5) Smoke test (must pass)

```bash
export GATEWAY_URL="https://ai-gateway-674116041377.us-west1.run.app/v1"
export API_KEY="sk-<scoped-key>"

# models
curl -sS "$GATEWAY_URL/models" \
  -H "Authorization: Bearer $API_KEY"

# chat
curl -sS -X POST "$GATEWAY_URL/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model":"gemini-2.0-flash",
    "messages":[{"role":"user","content":"Reply with OK"}]
  }'

# embeddings
curl -sS -X POST "$GATEWAY_URL/embeddings" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model":"text-embedding-004",
    "input":"integration test"
  }'
```
