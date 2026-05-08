# ============================================================================
# PHASE 3: APP DEPLOYMENT
# ============================================================================
# Deploys Knowledge API Cloud Run service to spoke project using cloudrun-sa
# created in Phase 2 (spoke onboarding)

# ============================================================================
# KNOWLEDGE API SERVICE
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
resource "google_cloud_run_v2_service" "knowledge_api" {
  name                 = "knowledge-api"
  location             = var.region
  deletion_protection  = false
  invoker_iam_disabled = true # Keep as-is - already deployed with this setting
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
      "config-version" = "20260331-07-stream-scope-digest-fix"
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
        "${var.region}-docker.pkg.dev/${var.spoke_project_id}/demo-registry/knowledge-api:latest"
      )

      ports {
        container_port = 8080
      }

      # Resource limits
      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
      }

      # AlloyDB connection URL
      env {
        name = "ALLOYDB_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.alloydb_url.secret_id
            version = "latest"
          }
        }
      }

      # Service authentication secret (for JWT verification)
      env {
        name = "SERVICE_AUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.service_auth_secret.secret_id
            version = "latest"
          }
        }
      }

      # Vertex AI direct embeddings (no gateway needed)
      # EMBEDDING_GATEWAY_URL deliberately left unset — triggers direct Vertex AI path
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
        name  = "VERTEX_AI_LOCATION"
        value = var.vertex_ai_location
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.spoke_project_id
      }

      # Environment
      env {
        name  = "ENVIRONMENT"
        value = "production"
      }

      env {
        name  = "KB_HERMETIC_ISOLATION"
        value = "true"
      }

      # Auth enabled
      env {
        name  = "AUTH_ENABLED"
        value = "true"
      }

      # Embedding model configuration
      env {
        name  = "EMBEDDING_MODEL"
        value = "text-embedding-004"
      }

      env {
        name  = "EMBEDDING_DIMENSIONS"
        value = "768"
      }

      # AlloyDB connection pool settings
      env {
        name  = "ALLOYDB_POOL_MIN"
        value = "2"
      }

      env {
        name  = "ALLOYDB_POOL_MAX"
        value = "20"
      }

      # Logging
      env {
        name  = "LOG_LEVEL"
        value = "INFO"
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.run,
    google_alloydb_instance.knowledge_primary,
    google_secret_manager_secret_version.alloydb_url,
    google_secret_manager_secret_version.service_auth_secret,
    google_compute_forwarding_rule.db_psc_endpoint # Wait for PSC endpoint
  ]
}

# ============================================================================
# IAM PERMISSIONS
# ============================================================================
# Allow cloudrun-sa service account to invoke this service
# (Required because invoker_iam_disabled = true blocks public access)

resource "google_cloud_run_v2_service_iam_binding" "knowledge_api_invoker" {
  project  = var.spoke_project_id
  location = var.region
  name     = google_cloud_run_v2_service.knowledge_api.name
  role     = "roles/run.invoker"
  members = [
    "serviceAccount:${data.google_service_account.cloudrun_sa.email}",
  ]
}
