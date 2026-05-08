# ============================================================================
# REQUIRED GCP APIs
# ============================================================================

resource "google_project_service" "run" {
  project = var.spoke_project_id
  service = "run.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  project = var.spoke_project_id
  service = "secretmanager.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "storage" {
  project = var.spoke_project_id
  service = "storage.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "pubsub" {
  project = var.spoke_project_id
  service = "pubsub.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "documentai" {
  project = var.spoke_project_id
  service = "documentai.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "redis" {
  project = var.spoke_project_id
  service = "redis.googleapis.com"

  disable_on_destroy = false
}

# Redis instance lives in the hub project (Shared VPC constraint) — enable
# the API there so Terraform can create the Memorystore instance.
resource "google_project_service" "redis_hub" {
  project = var.hub_project_id
  service = "redis.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "vpcaccess" {
  project = var.spoke_project_id
  service = "vpcaccess.googleapis.com"

  disable_on_destroy = false
}
