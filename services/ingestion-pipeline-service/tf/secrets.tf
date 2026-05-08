# ============================================================================
# SECRET MANAGER SECRETS
# ============================================================================
# Secrets for Ingestion Pipeline Service configuration

resource "random_password" "service_auth" {
  length  = 64
  special = true
}

# ── Service Auth Secret ────────────────────────────────────────────────────

resource "google_secret_manager_secret" "service_auth_secret" {
  secret_id = "pipeline-service-auth-secret"
  project   = var.spoke_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "service_auth_secret" {
  secret = google_secret_manager_secret.service_auth_secret.id

  secret_data = random_password.service_auth.result

  lifecycle {
    ignore_changes = [secret_data]
  }
}

# ── LiteLLM API Key ──────────────────────────────────────────────────────

resource "google_secret_manager_secret" "litellm_api_key" {
  secret_id = "pipeline-litellm-api-key"
  project   = var.spoke_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

resource "google_secret_manager_secret_version" "litellm_api_key" {
  secret = google_secret_manager_secret.litellm_api_key.id

  secret_data = "REPLACE_WITH_LITELLM_KEY"

  lifecycle {
    ignore_changes = [secret_data]
  }
}

# ── Knowledge API Access ────────────────────────────────────────────────────

resource "google_secret_manager_secret" "knowledge_api_key" {
  secret_id = "pipeline-knowledge-api-key"
  project   = var.spoke_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

# Note: Set this manually after creation:
# gcloud secrets versions add pipeline-knowledge-api-key --data-file=- <<< "your-api-key"
resource "google_secret_manager_secret_version" "knowledge_api_key" {
  secret = google_secret_manager_secret.knowledge_api_key.id

  secret_data = "REPLACE_WITH_ACTUAL_API_KEY"

  lifecycle {
    ignore_changes = [secret_data]
  }
}

# TEMPORARILY COMMENTED: Requires secretmanager.secrets.setIamPolicy permission
# Uncomment when IAM permissions are available
# resource "google_secret_manager_secret_iam_member" "knowledge_api_key_access" {
#   secret_id = google_secret_manager_secret.knowledge_api_key.id
#   role      = "roles/secretmanager.secretAccessor"
#   member    = "serviceAccount:${data.google_service_account.cloudrun_sa.email}"
#   project   = var.spoke_project_id
# }

# ── Redis Connection ────────────────────────────────────────────────────────

resource "google_secret_manager_secret" "redis_url" {
  secret_id = "pipeline-redis-url"
  project   = var.spoke_project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.secretmanager]
}

# Wire real Redis URL from Memorystore instance
resource "google_secret_manager_secret_version" "redis_url" {
  secret      = google_secret_manager_secret.redis_url.id
  secret_data = "redis://${google_redis_instance.pipeline_cache.host}:${google_redis_instance.pipeline_cache.port}/0"
}

# TEMPORARILY COMMENTED: Requires secretmanager.secrets.setIamPolicy permission
# Uncomment when IAM permissions are available
# resource "google_secret_manager_secret_iam_member" "redis_url_access" {
#   secret_id = google_secret_manager_secret.redis_url.id
#   role      = "roles/secretmanager.secretAccessor"
#   member    = "serviceAccount:${data.google_service_account.cloudrun_sa.email}"
#   project   = var.spoke_project_id
# }
