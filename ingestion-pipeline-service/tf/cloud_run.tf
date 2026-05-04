# ============================================================================
# INGESTION PIPELINE SERVICE DEPLOYMENT
# ============================================================================
# Deploys Ingestion Pipeline Service to Cloud Run
# Handles document upload, processing, and ingestion into knowledge base

# ============================================================================
# DATA SOURCES
# ============================================================================

# Reference the shared VPC network created in hub
data "google_compute_network" "hub_vpc" {
  project = var.hub_project_id
  name    = "cilab-shared-vpc"
}

# Reference the shared subnet for common apps
data "google_compute_subnetwork" "common_apps" {
  project = var.hub_project_id
  region  = var.region
  name    = "common-apps-subnet"
}

# Reference the cloudrun-sa service account created in Phase 2
data "google_service_account" "cloudrun_sa" {
  project    = var.spoke_project_id
  account_id = "cloudrun-sa"
}

# ============================================================================
# INGESTION PIPELINE SERVICE
# ============================================================================

resource "google_cloud_run_v2_service" "pipeline" {
  name                 = "ingestion-pipeline-service"
  location             = var.region
  deletion_protection  = false
  invoker_iam_disabled = true # BFF calls without IAM token; service-level JWT auth via X-Service-Auth
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
      "config-version" = "20260331-05-enrich-self-fix"
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
        "${var.region}-docker.pkg.dev/${var.spoke_project_id}/demo-registry/ingestion-pipeline-service:latest"
      )

      ports {
        container_port = 9508
      }

      # Resource limits
      resources {
        limits = {
          cpu    = "2"
          memory = "4Gi"
        }
      }

      # ======================================================================
      # SERVICE CONFIGURATION
      # ======================================================================

      env {
        name  = "ENVIRONMENT"
        value = "production"
      }

      env {
        name  = "KB_HERMETIC_ISOLATION"
        value = "true"
      }

      env {
        name  = "LOG_LEVEL"
        value = "INFO"
      }

      env {
        name  = "AUTH_ENABLED"
        value = "true"
      }

      env {
        name = "SERVICE_AUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.service_auth_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "LLM_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.litellm_api_key.secret_id
            version = "latest"
          }
        }
      }

      # ======================================================================
      # KNOWLEDGE API INTEGRATION
      # ======================================================================

      env {
        name  = "KNOWLEDGE_API_URL"
        value = var.knowledge_api_url
      }

      env {
        name = "KNOWLEDGE_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.knowledge_api_key.secret_id
            version = "latest"
          }
        }
      }

      # ======================================================================
      # CLOUD STORAGE
      # ======================================================================

      env {
        name  = "GCS_BUCKET"
        value = google_storage_bucket.documents.name
      }

      # ======================================================================
      # PUB/SUB
      # ======================================================================

      env {
        name  = "PUBSUB_TOPIC"
        value = google_pubsub_topic.document_processing.name
      }

      env {
        name  = "PUBSUB_SUBSCRIPTION"
        value = google_pubsub_subscription.document_processing.name
      }

      # ======================================================================
      # REDIS (JOB PERSISTENCE)
      # ======================================================================

      env {
        name = "REDIS_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.redis_url.secret_id
            version = "latest"
          }
        }
      }

      # ======================================================================
      # VERTEX AI (ADK native — google.genai via ADC)
      # ======================================================================

      env {
        name  = "GOOGLE_GENAI_USE_VERTEXAI"
        value = "true"
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.spoke_project_id
      }

      env {
        name  = "GOOGLE_CLOUD_LOCATION"
        value = var.vertex_ai_location
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.spoke_project_id
      }

      env {
        name  = "VERTEX_AI_LOCATION"
        value = var.vertex_ai_location
      }

      env {
        name  = "LLM_MODEL"
        value = "gemini-2.5-flash"
      }

      env {
        name  = "LLM_ENABLED"
        value = "true"
      }

      # LLM_GATEWAY_URL deliberately left unset — triggers direct Vertex AI path

      # ======================================================================
      # DOCUMENT AI (OPTIONAL)
      # ======================================================================

      env {
        name  = "ENABLE_DOCUMENT_AI"
        value = "false"
      }

      env {
        name  = "DOCUMENT_AI_PROCESSOR_ID"
        value = ""
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.run,
    google_storage_bucket.documents,
    google_pubsub_topic.document_processing,
    google_secret_manager_secret_version.knowledge_api_key,
    google_secret_manager_secret_version.service_auth_secret,
    google_secret_manager_secret_version.litellm_api_key,
  ]
}

# ============================================================================
# IAM PERMISSIONS
# ============================================================================
# Allow cloudrun-sa service account to invoke this service
# (Required because invoker_iam_disabled = true blocks public access)

resource "google_cloud_run_v2_service_iam_binding" "ingestion_pipeline_invoker" {
  project  = var.spoke_project_id
  location = var.region
  name     = google_cloud_run_v2_service.pipeline.name
  role     = "roles/run.invoker"
  members = [
    "serviceAccount:${data.google_service_account.cloudrun_sa.email}",
  ]
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "pipeline_service_url" {
  description = "URL of the deployed Ingestion Pipeline Service"
  value       = google_cloud_run_v2_service.pipeline.uri
}

output "gcs_bucket_name" {
  description = "GCS bucket for document uploads"
  value       = google_storage_bucket.documents.name
}

output "pubsub_topic" {
  description = "Pub/Sub topic for document processing"
  value       = google_pubsub_topic.document_processing.name
}
