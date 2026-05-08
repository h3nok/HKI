variable "hub_project_id" {
  description = "GCP project ID for the hub (shared VPC, IAP)"
  type        = string
}

variable "spoke_project_id" {
  description = "GCP project ID for the spoke (Cloud Run services)"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-west1"
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
