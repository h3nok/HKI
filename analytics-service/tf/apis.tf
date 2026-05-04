# ============================================================================
# REQUIRED APIS
# ============================================================================

resource "google_project_service" "run" {
  project            = var.spoke_project_id
  service            = "run.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "bigquery" {
  project            = var.spoke_project_id
  service            = "bigquery.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "secretmanager" {
  project            = var.spoke_project_id
  service            = "secretmanager.googleapis.com"
  disable_on_destroy = false
}
