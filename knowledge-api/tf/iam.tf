# ============================================================================
# IAM PERMISSIONS
# ============================================================================
# Grant Cloud Run service account access to required GCP services

# Allow Cloud Run service account to connect to AlloyDB
resource "google_project_iam_member" "cloudrun_alloydb_client" {
  project = var.spoke_project_id
  role    = "roles/alloydb.client"
  member  = "serviceAccount:${data.google_service_account.cloudrun_sa.email}"
}
