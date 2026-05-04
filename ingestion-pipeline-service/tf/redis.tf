# ============================================================================
# MEMORYSTORE FOR REDIS — Review Workflow Persistent Store
# ============================================================================
# Stores the review queue state (pending, approved, published records) across
# Cloud Run restarts. Without this, all review records are lost on scale-to-zero.
#
# Must live in the hub project — Memorystore does not support Shared VPC
# (cannot reference a network from a different project). Cloud Run reaches it
# via VPC egress on cilab-shared-vpc.

resource "google_redis_instance" "pipeline_review_store" {
  name           = "pipeline-review-redis"
  display_name   = "Pipeline Review Store"
  tier           = "BASIC"
  memory_size_gb = 1
  region         = var.region

  project            = var.hub_project_id
  authorized_network = "projects/${var.hub_project_id}/global/networks/cilab-shared-vpc"
  connect_mode       = "DIRECT_PEERING"

  redis_version = "REDIS_7_2"

  auth_enabled            = false
  transit_encryption_mode = "DISABLED"

  depends_on = [google_project_service.redis_hub]
}

# ============================================================================
# WIRE REDIS URL INTO SECRET MANAGER
# ============================================================================
# Adds a new version of the existing pipeline-redis-url secret, replacing
# the localhost placeholder with the real Memorystore host. Cloud Run reads
# REDIS_URL from this secret at startup.

resource "google_secret_manager_secret_version" "redis_url_real" {
  secret      = google_secret_manager_secret.redis_url.id
  secret_data = "redis://${google_redis_instance.pipeline_review_store.host}:${google_redis_instance.pipeline_review_store.port}/0"
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "redis_host" {
  description = "Memorystore Redis host (internal VPC IP)"
  value       = google_redis_instance.pipeline_review_store.host
}

output "redis_port" {
  description = "Memorystore Redis port"
  value       = google_redis_instance.pipeline_review_store.port
}
