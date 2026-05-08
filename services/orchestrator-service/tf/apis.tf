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

resource "google_project_service" "compute" {
  project = var.spoke_project_id
  service = "compute.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "vpcaccess" {
  project = var.spoke_project_id
  service = "vpcaccess.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "redis" {
  project = var.spoke_project_id
  service = "redis.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "servicenetworking" {
  project = var.spoke_project_id
  service = "servicenetworking.googleapis.com"

  disable_on_destroy = false
}

resource "google_project_service" "aiplatform" {
  project = var.spoke_project_id
  service = "aiplatform.googleapis.com"

  # Required for Vertex AI Agent Engine (Reasoning Engine) deployment.
  # Also enables Vertex AI model access, vector search, and model monitoring.
  disable_on_destroy = false
}
