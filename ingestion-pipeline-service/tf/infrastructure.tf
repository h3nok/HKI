# ============================================================================
# STORAGE & MESSAGING INFRASTRUCTURE
# ============================================================================

# ── Cloud Storage Bucket ──────────────────────────────────────────────────

resource "google_storage_bucket" "documents" {
  name                        = var.gcs_bucket_name
  location                    = var.region
  project                     = var.spoke_project_id
  force_destroy               = false
  public_access_prevention    = "enforced"
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age                   = 30
      matches_storage_class = ["STANDARD"]
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }

  labels = {
    environment = "lab"
    purpose     = "document-ingestion"
    managed_by  = "terraform"
  }
}

# Grant Cloud Run service account access to bucket
resource "google_storage_bucket_iam_member" "pipeline_bucket_access" {
  bucket = google_storage_bucket.documents.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${data.google_service_account.cloudrun_sa.email}"
}

# ── Pub/Sub Topic & Subscription ──────────────────────────────────────────

resource "google_pubsub_topic" "document_processing" {
  name    = "ingestion-pipeline-documents"
  project = var.spoke_project_id

  message_retention_duration = "604800s"  # 7 days
}

resource "google_pubsub_subscription" "document_processing" {
  name    = "ingestion-pipeline-documents-sub"
  topic   = google_pubsub_topic.document_processing.name
  project = var.spoke_project_id

  ack_deadline_seconds = 600  # 10 minutes for processing

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }
}

resource "google_pubsub_topic" "dead_letter" {
  name    = "ingestion-pipeline-dead-letter"
  project = var.spoke_project_id
}

resource "google_pubsub_subscription" "dead_letter" {
  name    = "ingestion-pipeline-dead-letter-sub"
  topic   = google_pubsub_topic.dead_letter.name
  project = var.spoke_project_id
}

# Grant Cloud Run service account Pub/Sub permissions
# TEMPORARILY COMMENTED: Requires pubsub.topics.setIamPolicy permission
# Uncomment when IAM permissions are available
# resource "google_pubsub_topic_iam_member" "pipeline_publisher" {
#   topic   = google_pubsub_topic.document_processing.name
#   role    = "roles/pubsub.publisher"
#   member  = "serviceAccount:${data.google_service_account.cloudrun_sa.email}"
#   project = var.spoke_project_id
# }

# TEMPORARILY COMMENTED: Requires pubsub.subscriptions.setIamPolicy permission
# Uncomment when IAM permissions are available
# resource "google_pubsub_subscription_iam_member" "pipeline_subscriber" {
#   subscription = google_pubsub_subscription.document_processing.name
#   role         = "roles/pubsub.subscriber"
#   member       = "serviceAccount:${data.google_service_account.cloudrun_sa.email}"
#   project      = var.spoke_project_id
# }

# ────────────────────────────────────────────────────────────────────────
# MEMORYSTORE FOR REDIS — Review Queue Persistence
# ────────────────────────────────────────────────────────────────────────
# Provides persistent storage for document review queue state.
# Without this, the queue is lost on service restart.

resource "google_redis_instance" "pipeline_cache" {
  name           = "ingestion-pipeline-redis"
  display_name   = "Ingestion Pipeline Review Queue Cache"
  tier           = "BASIC"
  memory_size_gb = 1
  region         = var.region

  # Must live in the hub project — GCP Memorystore does not support Shared VPC
  # (cannot reference a network from a different project). Cloud Run reaches it
  # via ALL_TRAFFIC VPC egress on the same cilab-shared-vpc network.
  project            = var.hub_project_id
  authorized_network = "projects/${var.hub_project_id}/global/networks/cilab-shared-vpc"
  connect_mode       = "DIRECT_PEERING"

  redis_version = "REDIS_7_2"

  # VPC-isolated — no public endpoint, no auth overhead needed
  auth_enabled            = false
  transit_encryption_mode = "DISABLED"

  depends_on = [google_project_service.redis]

  labels = {
    environment = "lab"
    purpose     = "review-queue-persistence"
    managed_by  = "terraform"
  }
}
