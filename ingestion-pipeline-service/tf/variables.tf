variable "hub_project_id" {
  description = "The hub project ID (where shared VPC lives)"
  type        = string
}

variable "spoke_project_id" {
  description = "The spoke project ID (where this app will be deployed)"
  type        = string
}

variable "region" {
  description = "GCP region for deployment"
  type        = string
  default     = "us-west1"
}

variable "knowledge_api_url" {
  description = "URL of the Knowledge API for break-glass legacy Cloud Run only; set explicitly if used"
  type        = string
  default     = ""
}

variable "gcs_bucket_name" {
  description = "GCS bucket for document landing zone"
  type        = string
  default     = "ingestion-pipeline-documents"
}

variable "vertex_ai_location" {
  description = "GCP location for Vertex AI model calls (LLM contextualization)"
  type        = string
  default     = "us-central1"
}

variable "container_image" {
  description = "Optional fully qualified container image reference for Cloud Run"
  type        = string
  default     = null
}

variable "allow_legacy_cloud_run" {
  description = "Set true only for break-glass legacy Cloud Run work. Production runtime is GKE."
  type        = bool
  default     = false
}
