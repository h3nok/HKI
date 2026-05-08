# ============================================================================
# VERTEX AI AGENT ENGINE RESOURCES
# ============================================================================
# Optional Agent Engine infrastructure for remote agent deployment
# Requires: aiplatform.googleapis.com API enabled (see apis.tf)

# ============================================================================
# GCS BUCKET FOR AGENT ENGINE STAGING
# ============================================================================

resource "google_storage_bucket" "agent_engine_staging" {
  name                        = "${var.spoke_project_id}-agent-engine"
  location                    = var.region
  project                     = var.spoke_project_id
  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true

  lifecycle {
    prevent_destroy = true
    # Bucket already exists; treat immutable fields as externally managed.
    ignore_changes = [
      location,
      lifecycle_rule,
      labels,
    ]
  }

  lifecycle_rule {
    condition {
      age = 30 # Delete old agent versions after 30 days
    }
    action {
      type = "Delete"
    }
  }

  labels = {
    app         = "orchestrator-service"
    component   = "agent-engine"
    environment = "production"
  }
}

# Grant Cloud Run service account read access to staging bucket
resource "google_storage_bucket_iam_member" "agent_engine_staging_reader" {
  bucket = google_storage_bucket.agent_engine_staging.name
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${data.google_service_account.cloudrun_sa.email}"
}

# Grant Cloud Run service account write access for deployment
resource "google_storage_bucket_iam_member" "agent_engine_staging_writer" {
  bucket = google_storage_bucket.agent_engine_staging.name
  role   = "roles/storage.objectCreator"
  member = "serviceAccount:${data.google_service_account.cloudrun_sa.email}"
}

# ============================================================================
# SECRET MANAGER — AGENT ENGINE RESOURCE NAME
# ============================================================================

resource "google_secret_manager_secret" "agent_engine_resource_name" {
  secret_id = "orchestrator-agent-engine-resource-name"
  project   = var.spoke_project_id

  replication {
    auto {}
  }

  labels = {
    app       = "orchestrator-service"
    component = "agent-engine"
  }
}

# Note: cloudrun-sa already has project-level secretAccessor in this environment.
# Per-secret IAM requires secretmanager.secrets.setIamPolicy permission and is
# intentionally not managed here.

# ============================================================================
# IAM ROLES FOR AGENT ENGINE
# ============================================================================

# Grant Cloud Run SA permission to use Vertex AI
resource "google_project_iam_member" "vertex_ai_user" {
  project = var.spoke_project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${data.google_service_account.cloudrun_sa.email}"
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "agent_engine_staging_bucket" {
  description = "GCS bucket for Agent Engine staging"
  value       = "gs://${google_storage_bucket.agent_engine_staging.name}"
}

output "agent_engine_resource_name_secret" {
  description = "Secret Manager secret for Agent Engine resource name"
  value       = google_secret_manager_secret.agent_engine_resource_name.id
}
