# ============================================================================
# SECRET MANAGER SECRETS
# ============================================================================
# Secrets for Orchestrator Service configuration

# ── Service Authentication ──────────────────────────────────────────────────
#
# Must match the Agentic BFF signing key (SERVICE_AUTH_SECRET / JWT_SECRET →
# agentic-jwt-secret). BFF mints HS256 request JWTs; orchestrator verifies with
# the same secret. Do NOT use a separate random secret here — that causes 401
# "Signature verification failed".

data "google_secret_manager_secret_version" "agentic_jwt" {
  project = var.spoke_project_id
  secret  = "agentic-jwt-secret"
  version = "latest"
}

# Note: cloudrun-sa already holds roles/secretmanager.secretAccessor at the
# project level — per-secret bindings are not needed.

# ── LiteLLM Gateway ─────────────────────────────────────────────────────────

resource "google_secret_manager_secret" "litellm_api_key" {
  secret_id = "orchestrator-litellm-api-key"
  project   = var.spoke_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

# Note: You need to manually set this secret value after creation:
# gcloud secrets versions add orchestrator-litellm-api-key --data-file=- <<< "your-litellm-api-key"
resource "google_secret_manager_secret_version" "litellm_api_key" {
  secret = google_secret_manager_secret.litellm_api_key.id

  # Placeholder - update manually after creation
  secret_data = "REPLACE_ME_WITH_ACTUAL_LITELLM_API_KEY"

  lifecycle {
    ignore_changes = [secret_data]
  }
}

# ── Redis Connection ────────────────────────────────────────────────────────

resource "google_secret_manager_secret" "redis_url" {
  secret_id = "orchestrator-redis-url"
  project   = var.spoke_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

# Note: You need to manually set this secret value:
# gcloud secrets versions add orchestrator-redis-url --data-file=- <<< "redis://host:port"
resource "google_secret_manager_secret_version" "redis_url" {
  secret = google_secret_manager_secret.redis_url.id

  # Placeholder - update manually with actual Redis URL
  secret_data = "redis://localhost:6379"

  lifecycle {
    ignore_changes = [secret_data]
  }
}
