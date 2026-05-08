# ============================================================================
# ANALYTICS SERVICE DEPLOYMENT
# ============================================================================
# Lightweight event analytics — collects agent usage events, flushes to BigQuery
# No database dependency (in-memory buffer + BigQuery). No Redis or LiteLLM.

# ============================================================================
# DATA SOURCES
# ============================================================================

data "google_compute_network" "hub_vpc" {
  project = var.hub_project_id
  name    = "cilab-shared-vpc"
}

data "google_compute_subnetwork" "common_apps" {
  project = var.hub_project_id
  region  = var.region
  name    = "common-apps-subnet"
}

data "google_service_account" "cloudrun_sa" {
  project    = var.spoke_project_id
  account_id = "cloudrun-sa"
}

# ============================================================================
# ANALYTICS SERVICE
# ============================================================================

resource "google_cloud_run_v2_service" "analytics" {
  name                 = "analytics-service"
  location             = var.region
  deletion_protection  = false
  invoker_iam_disabled = true # Route through GLB + IAP only
  project              = var.spoke_project_id

  lifecycle {
    precondition {
      condition     = var.allow_legacy_cloud_run
      error_message = "Cloud Run deployment is retired; use the GKE deployment path unless you intentionally set allow_legacy_cloud_run=true for break-glass recovery."
    }
  }

  template {
    service_account = data.google_service_account.cloudrun_sa.email

    annotations = {
      "config-version" = "20260317-01-initial"
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 4
    }

    vpc_access {
      network_interfaces {
        network    = "projects/${data.google_compute_network.hub_vpc.project}/global/networks/${data.google_compute_network.hub_vpc.name}"
        subnetwork = "projects/${data.google_compute_subnetwork.common_apps.project}/regions/${data.google_compute_subnetwork.common_apps.region}/subnetworks/${data.google_compute_subnetwork.common_apps.name}"
      }
      egress = "ALL_TRAFFIC"
    }

    containers {
      image = coalesce(
        var.container_image,
        "${var.region}-docker.pkg.dev/${var.spoke_project_id}/demo-registry/analytics-service:latest"
      )

      ports {
        container_port = 9512
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }

      env {
        name  = "ENVIRONMENT"
        value = "production"
      }

      env {
        name  = "SERVICE_PORT"
        value = "9512"
      }

      # BigQuery configuration
      env {
        name  = "BQ_DATASET"
        value = "analytics"
      }

      env {
        name  = "BQ_TABLE_EVENTS"
        value = "agent_events"
      }

      env {
        name  = "LOG_LEVEL"
        value = "INFO"
      }

      env {
        name  = "ENABLE_TRACING"
        value = "true"
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.run,
  ]
}

# ============================================================================
# IAM PERMISSIONS
# ============================================================================
# Allow cloudrun-sa service account to invoke this service
# (Required because invoker_iam_disabled = true blocks public access)

resource "google_cloud_run_v2_service_iam_binding" "analytics_invoker" {
  project  = var.spoke_project_id
  location = var.region
  name     = google_cloud_run_v2_service.analytics.name
  role     = "roles/run.invoker"
  members = [
    "serviceAccount:${data.google_service_account.cloudrun_sa.email}",
  ]
}

# ============================================================================
# IAP (Identity-Aware Proxy) CONFIGURATION
# ============================================================================

resource "google_compute_region_network_endpoint_group" "analytics_neg" {
  name                  = "analytics-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  project               = var.spoke_project_id

  cloud_run {
    service = google_cloud_run_v2_service.analytics.name
  }
}

# ============================================================================
# BIGQUERY DATASET
# ============================================================================

resource "google_bigquery_dataset" "analytics" {
  dataset_id = "analytics"
  project    = var.spoke_project_id
  location   = var.region

  labels = {
    app = "analytics-service"
  }
}

resource "google_bigquery_table" "agent_events" {
  dataset_id          = google_bigquery_dataset.analytics.dataset_id
  project             = var.spoke_project_id
  table_id            = "agent_events"
  deletion_protection = false

  schema = jsonencode([
    { name = "event_id", type = "STRING", mode = "REQUIRED" },
    { name = "event_type", type = "STRING", mode = "REQUIRED" },
    { name = "session_id", type = "STRING", mode = "NULLABLE" },
    { name = "user_id", type = "STRING", mode = "NULLABLE" },
    { name = "payload", type = "JSON", mode = "NULLABLE" },
    { name = "created_at", type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "analytics_service_url" {
  description = "URL of the deployed Analytics Service"
  value       = google_cloud_run_v2_service.analytics.uri
}
