# ============================================================================
# ORCHESTRATOR SERVICE DEPLOYMENT
# ============================================================================
# Deploys Orchestrator Service (agentic brain) to Cloud Run
# Handles ReAct loop, routing, guardrails, and conversation memory

# ============================================================================
# DATA SOURCES
# ============================================================================

# Reference the shared VPC network created in hub
data "google_compute_network" "hub_vpc" {
  project = var.hub_project_id
  name    = "cilab-shared-vpc"
}

#Reference the shared subnet for common apps
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
# ORCHESTRATOR SERVICE
# ============================================================================

resource "google_cloud_run_v2_service" "orchestrator" {
  name                 = "orchestrator-service"
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
      # Update this to force new revision when config changes
      "config-version" = "20260331-04-vertex-dropdown-fix"
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
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
        "${var.region}-docker.pkg.dev/${var.spoke_project_id}/demo-registry/orchestrator-service:latest"
      )

      ports {
        container_port = 9501
      }

      # Resource limits - orchestrator needs more resources for agent reasoning
      resources {
        limits = {
          cpu    = "4"
          memory = "4Gi"
        }
      }

      # ======================================================================
      # SERVICE CONFIGURATION
      # ======================================================================

      # Same HS256 secret as Agentic BFF (sign-request-jwt.ts) — agentic-jwt-secret
      env {
        name = "SERVICE_AUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = "agentic-jwt-secret"
            version = "latest"
          }
        }
      }

      # Environment
      env {
        name  = "ENVIRONMENT"
        value = "production"
      }

      # Auth enabled
      env {
        name  = "AUTH_ENABLED"
        value = "true"
      }

      # ======================================================================
      # LLM CONFIGURATION (via LiteLLM Gateway)
      # ======================================================================

      env {
        name  = "LLM_GATEWAY_URL"
        value = var.litellm_gateway_url
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

      env {
        name  = "LLM_MODEL_DEFAULT"
        value = "gemini-2.5-flash"
      }

      # ======================================================================
      # MCP CONFIGURATION (Knowledge API)
      # ======================================================================

      env {
        name  = "KNOWLEDGE_API_URL"
        value = var.knowledge_api_url
      }

      # ======================================================================
      # MEMORY & CACHING (Redis)
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

      env {
        name  = "CONVERSATION_MEMORY_TTL"
        value = "3600" # 1 hour
      }

      # ======================================================================
      # OBSERVABILITY
      # ======================================================================

      env {
        name  = "LOG_LEVEL"
        value = "INFO"
      }

      env {
        name  = "ENABLE_TRACING"
        value = "true"
      }

      # ======================================================================
      # AGENT CONFIGURATION
      # ======================================================================

      env {
        name  = "MAX_REASONING_STEPS"
        value = "10"
      }

      env {
        name  = "ENABLE_GUARDRAILS"
        value = "true"
      }

      env {
        name  = "TIMEOUT_SECONDS"
        value = "120"
      }

      # ======================================================================
      # VERTEX AI (ADK native — google.genai via ADC)
      # ======================================================================

      env {
        name  = "GCP_PROJECT_ID"
        value = var.spoke_project_id
      }

      env {
        name  = "GCP_LOCATION"
        value = var.region
      }

      env {
        name  = "VERTEX_AI_LOCATION"
        value = var.vertex_ai_location
      }

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
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.run,
    data.google_secret_manager_secret_version.agentic_jwt,
    google_secret_manager_secret_version.litellm_api_key,
    google_secret_manager_secret_version.redis_url_real,
  ]
}

# ============================================================================
# IAM PERMISSIONS
# ============================================================================
# Allow cloudrun-sa service account to invoke this service
# (Required because invoker_iam_disabled = true blocks public access)

resource "google_cloud_run_v2_service_iam_binding" "orchestrator_invoker" {
  project  = var.spoke_project_id
  location = var.region
  name     = google_cloud_run_v2_service.orchestrator.name
  role     = "roles/run.invoker"
  members = [
    "serviceAccount:${data.google_service_account.cloudrun_sa.email}",
  ]
}

# ============================================================================
# IAP (Identity-Aware Proxy) CONFIGURATION
# ============================================================================

# Create backend service for IAP
resource "google_compute_region_network_endpoint_group" "orchestrator_neg" {
  name                  = "orchestrator-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  project               = var.spoke_project_id

  cloud_run {
    service = google_cloud_run_v2_service.orchestrator.name
  }
}

# ============================================================================
# OUTPUTS
# ============================================================================

output "orchestrator_service_url" {
  description = "URL of the deployed Orchestrator Service"
  value       = google_cloud_run_v2_service.orchestrator.uri
}

output "orchestrator_service_name" {
  description = "Name of the Cloud Run service"
  value       = google_cloud_run_v2_service.orchestrator.name
}
