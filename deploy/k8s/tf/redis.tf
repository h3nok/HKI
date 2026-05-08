# ============================================================================
# MEMORYSTORE REDIS — Consolidated Platform Cache
# ============================================================================
# Single Redis instance shared across services using separate DB indexes:
#   DB 0 — orchestrator (conversation memory, rate limiting)
#   DB 1 — knowledge-api (search cache, embedding cache)
#   DB 2 — ingestion-pipeline (job persistence, concurrency slots)
#
# Must live in the hub project (p-642-cilab-infrastructure).
# GCP Memorystore does not support Shared VPC from a service project;
# authorized_network must be in the same project as the Redis instance.

resource "google_redis_instance" "platform" {
  project        = var.hub_project_id
  name           = "platform-redis"
  display_name   = "Platform Shared Redis Cache"
  tier           = "STANDARD_HA"   # HA tier for production resilience
  memory_size_gb = var.redis_memory_size_gb
  region         = var.region

  authorized_network = "projects/${var.hub_project_id}/global/networks/cilab-shared-vpc"
  connect_mode       = "DIRECT_PEERING"

  redis_version = "REDIS_7_2"

  # VPC-isolated; auth and TLS add overhead without value inside VPC
  auth_enabled            = false
  transit_encryption_mode = "DISABLED"

  depends_on = [google_project_service.hub_redis]
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "redis_host" {
  description = "Memorystore Redis host IP — use in k8s ConfigMaps"
  value       = google_redis_instance.platform.host
}

output "redis_port" {
  description = "Memorystore Redis port"
  value       = google_redis_instance.platform.port
}
