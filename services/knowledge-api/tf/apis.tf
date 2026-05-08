# ============================================================================
# API ENABLEMENT
# ============================================================================
# Enable required Google Cloud APIs for the spoke project

# Enable Compute Engine API (required for PSC forwarding rules and addresses)
resource "google_project_service" "compute" {
  project = var.spoke_project_id
  service = "compute.googleapis.com"

  disable_on_destroy = false
}

# Enable AlloyDB API
resource "google_project_service" "alloydb" {
  project = var.spoke_project_id
  service = "alloydb.googleapis.com"

  disable_on_destroy = false
}

# Enable Cloud Run API
resource "google_project_service" "run" {
  project = var.spoke_project_id
  service = "run.googleapis.com"

  disable_on_destroy = false
}

# Enable Secret Manager API
resource "google_project_service" "secretmanager" {
  project = var.spoke_project_id
  service = "secretmanager.googleapis.com"

  disable_on_destroy = false
}

# Enable Vertex AI API (for embeddings)
resource "google_project_service" "aiplatform" {
  project = var.spoke_project_id
  service = "aiplatform.googleapis.com"

  disable_on_destroy = false
}
