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

variable "vertex_ai_location" {
  description = "GCP location for Vertex AI model calls (embeddings, LLM)"
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

variable "gke_project_id" {
  description = "GKE project ID — added as AlloyDB PSC allowed consumer for k8s path"
  type        = string
  default     = "p-642-cilab-gke"
}
