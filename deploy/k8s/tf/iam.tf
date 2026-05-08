# ============================================================================
# IAM — GCP Service Accounts + Workload Identity Federation Bindings
# ============================================================================
# Each k8s workload gets its own GCP SA with minimal IAM roles.
# WIF allows the k8s SA (platform/<name>) to impersonate the GCP SA.
#
# Workload Identity pool: p-642-cilab-gke.svc.id.goog
# k8s SA namespace:       platform
# GCP SAs project:        p-642-cilab-demo

locals {
  wif_pool = "${var.gke_project_id}.svc.id.goog"

  # Map k8s SA name → GCP SA name
  service_accounts = {
    "orchestrator"       = "orchestrator-sa"
    "knowledge-api"      = "knowledge-api-sa"
    "ingestion-pipeline" = "ingestion-pipeline-sa"
    "agentic-bff"        = "agentic-bff-sa"
    "analytics"          = "analytics-sa"
  }
}

# ── Create GCP service accounts in spoke project ──────────────────────────────

resource "google_service_account" "orchestrator" {
  provider     = google.spoke
  project      = var.spoke_project_id
  account_id   = "orchestrator-sa"
  display_name = "Orchestrator Service — GKE Workload Identity"
}

resource "google_service_account" "knowledge_api" {
  provider     = google.spoke
  project      = var.spoke_project_id
  account_id   = "knowledge-api-sa"
  display_name = "Knowledge API — GKE Workload Identity"
}

resource "google_service_account" "ingestion_pipeline" {
  provider     = google.spoke
  project      = var.spoke_project_id
  account_id   = "ingestion-pipeline-sa"
  display_name = "Ingestion Pipeline — GKE Workload Identity"
}

resource "google_service_account" "agentic_bff" {
  provider     = google.spoke
  project      = var.spoke_project_id
  account_id   = "agentic-bff-sa"
  display_name = "Agentic BFF — GKE Workload Identity"
}

resource "google_service_account" "analytics" {
  provider     = google.spoke
  project      = var.spoke_project_id
  account_id   = "analytics-sa"
  display_name = "Analytics Service — GKE Workload Identity"
}

# ── IAM roles — orchestrator ──────────────────────────────────────────────────

resource "google_project_iam_member" "orchestrator_vertex" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/aiplatform.user"
  member   = "serviceAccount:${google_service_account.orchestrator.email}"
}

resource "google_project_iam_member" "orchestrator_secrets" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/secretmanager.secretAccessor"
  member   = "serviceAccount:${google_service_account.orchestrator.email}"
}

resource "google_project_iam_member" "orchestrator_trace" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/cloudtrace.agent"
  member   = "serviceAccount:${google_service_account.orchestrator.email}"
}

resource "google_project_iam_member" "orchestrator_metrics" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/monitoring.metricWriter"
  member   = "serviceAccount:${google_service_account.orchestrator.email}"
}

# ── IAM roles — knowledge-api ─────────────────────────────────────────────────

resource "google_project_iam_member" "knowledge_api_alloydb" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/alloydb.client"
  member   = "serviceAccount:${google_service_account.knowledge_api.email}"
}

resource "google_project_iam_member" "knowledge_api_alloydb_db_user" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/alloydb.databaseUser"
  member   = "serviceAccount:${google_service_account.knowledge_api.email}"
}

resource "google_project_iam_member" "knowledge_api_vertex" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/aiplatform.user"
  member   = "serviceAccount:${google_service_account.knowledge_api.email}"
}

resource "google_project_iam_member" "knowledge_api_secrets" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/secretmanager.secretAccessor"
  member   = "serviceAccount:${google_service_account.knowledge_api.email}"
}

resource "google_project_iam_member" "knowledge_api_trace" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/cloudtrace.agent"
  member   = "serviceAccount:${google_service_account.knowledge_api.email}"
}

resource "google_project_iam_member" "knowledge_api_metrics" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/monitoring.metricWriter"
  member   = "serviceAccount:${google_service_account.knowledge_api.email}"
}

# ── IAM roles — ingestion-pipeline ───────────────────────────────────────────

resource "google_project_iam_member" "ingestion_gcs" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/storage.objectAdmin"
  member   = "serviceAccount:${google_service_account.ingestion_pipeline.email}"
}

resource "google_project_iam_member" "ingestion_pubsub_pub" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/pubsub.publisher"
  member   = "serviceAccount:${google_service_account.ingestion_pipeline.email}"
}

resource "google_project_iam_member" "ingestion_pubsub_sub" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/pubsub.subscriber"
  member   = "serviceAccount:${google_service_account.ingestion_pipeline.email}"
}

resource "google_project_iam_member" "ingestion_vertex" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/aiplatform.user"
  member   = "serviceAccount:${google_service_account.ingestion_pipeline.email}"
}

resource "google_project_iam_member" "ingestion_trace" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/cloudtrace.agent"
  member   = "serviceAccount:${google_service_account.ingestion_pipeline.email}"
}

resource "google_project_iam_member" "ingestion_metrics" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/monitoring.metricWriter"
  member   = "serviceAccount:${google_service_account.ingestion_pipeline.email}"
}

# ── IAM roles — agentic-bff ───────────────────────────────────────────────────

resource "google_project_iam_member" "agentic_cloudsql" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/cloudsql.client"
  member   = "serviceAccount:${google_service_account.agentic_bff.email}"
}

# ── IAM roles — analytics ─────────────────────────────────────────────────────

resource "google_project_iam_member" "analytics_bigquery" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/bigquery.dataEditor"
  member   = "serviceAccount:${google_service_account.analytics.email}"
}

resource "google_project_iam_member" "analytics_bigquery_job" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/bigquery.jobUser"
  member   = "serviceAccount:${google_service_account.analytics.email}"
}

resource "google_project_iam_member" "analytics_trace" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/cloudtrace.agent"
  member   = "serviceAccount:${google_service_account.analytics.email}"
}

resource "google_project_iam_member" "analytics_metrics" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/monitoring.metricWriter"
  member   = "serviceAccount:${google_service_account.analytics.email}"
}

# ── Workload Identity bindings ────────────────────────────────────────────────
# Allows each k8s SA (platform/<name>) to impersonate its GCP SA via WIF.

resource "google_service_account_iam_member" "wif_orchestrator" {
  provider           = google.spoke
  service_account_id = google_service_account.orchestrator.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${local.wif_pool}[${var.k8s_namespace}/orchestrator]"
}

resource "google_service_account_iam_member" "wif_knowledge_api" {
  provider           = google.spoke
  service_account_id = google_service_account.knowledge_api.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${local.wif_pool}[${var.k8s_namespace}/knowledge-api]"
}

resource "google_service_account_iam_member" "wif_ingestion_pipeline" {
  provider           = google.spoke
  service_account_id = google_service_account.ingestion_pipeline.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${local.wif_pool}[${var.k8s_namespace}/ingestion-pipeline]"
}

resource "google_service_account_iam_member" "wif_agentic_bff" {
  provider           = google.spoke
  service_account_id = google_service_account.agentic_bff.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${local.wif_pool}[${var.k8s_namespace}/agentic-bff]"
}

resource "google_service_account_iam_member" "wif_analytics" {
  provider           = google.spoke
  service_account_id = google_service_account.analytics.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${local.wif_pool}[${var.k8s_namespace}/analytics]"
}

# ── IAM admin role for WIF binding management ─────────────────────────────────
# Grants the deployer account iam.serviceAccountAdmin in spoke project
# so it can set WIF bindings on GCP SAs.

resource "google_project_iam_member" "deployer_sa_admin" {
  provider = google.spoke
  project  = var.spoke_project_id
  role     = "roles/iam.serviceAccountAdmin"
  member   = "user:hghebrechristos@hki.com"
}
