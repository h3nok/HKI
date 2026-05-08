# ============================================================================
# MEMORYSTORE FOR REDIS — Orchestrator Memory & Rate Limiting
# ============================================================================
# Provides persistent conversation memory and distributed rate limiting
# across Cloud Run instances. Cloud Run connects via VPC egress (ALL_TRAFFIC).

resource "google_redis_instance" "orchestrator_cache" {
  name           = "orchestrator-redis"
  display_name   = "Orchestrator Memory Cache"
  tier           = "BASIC"
  memory_size_gb = 1
  region         = var.region

  # Must live in the hub project — GCP Memorystore does not support Shared VPC
  # (cannot reference a network from a different project). Cloud Run reaches it
  # via ALL_TRAFFIC VPC egress on the same cilab-shared-vpc network.
  project            = var.hub_project_id
  authorized_network = "projects/${var.hub_project_id}/global/networks/cilab-shared-vpc"
  connect_mode       = "DIRECT_PEERING"

  redis_version = "REDIS_7_2"

  # VPC-isolated — no public endpoint, no auth overhead needed
  auth_enabled            = false
  transit_encryption_mode = "DISABLED"

  depends_on = [google_project_service.redis]
}

# ============================================================================
# WIRE REDIS URL INTO SECRET MANAGER
# ============================================================================
# Replaces the localhost placeholder with the real Memorystore host.
# Cloud Run reads this at startup via the REDIS_URL env var.

resource "google_secret_manager_secret_version" "redis_url_real" {
  secret      = google_secret_manager_secret.redis_url.id
  secret_data = "redis://${google_redis_instance.orchestrator_cache.host}:${google_redis_instance.orchestrator_cache.port}/0"
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "redis_host" {
  description = "Memorystore Redis host (internal VPC IP)"
  value       = google_redis_instance.orchestrator_cache.host
}

output "redis_port" {
  description = "Memorystore Redis port"
  value       = google_redis_instance.orchestrator_cache.port
}
