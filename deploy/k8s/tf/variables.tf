variable "hub_project_id" {
  description = "Hub project — owns the shared VPC, Artifact Registry, Memorystore"
  type        = string
  default     = "p-642-cilab-infrastructure"
}

variable "spoke_project_id" {
  description = "Spoke project — owns AlloyDB, Cloud SQL, Secret Manager, GCP service accounts"
  type        = string
  default     = "p-642-cilab-demo"
}

variable "gke_project_id" {
  description = "GKE project — where the Autopilot cluster runs"
  type        = string
  default     = "p-642-cilab-gke"
}

variable "region" {
  description = "Primary GCP region"
  type        = string
  default     = "us-west1"
}

variable "cluster_name" {
  description = "GKE Autopilot cluster name"
  type        = string
  default     = "cilab-platform"
}

variable "k8s_namespace" {
  description = "Kubernetes namespace for all platform workloads"
  type        = string
  default     = "platform"
}

variable "master_ipv4_cidr" {
  description = "Private CIDR for GKE control plane"
  type        = string
  default     = "172.16.0.32/28"
}

variable "redis_memory_size_gb" {
  description = "Memorystore Redis size in GB"
  type        = number
  default     = 1
}

variable "observability_notification_channel_ids" {
  description = "Cloud Monitoring notification channel IDs for AI Platform alerts. Leave empty to create alert policies without notifications."
  type        = list(string)
  default     = []
}

variable "observability_platform_error_threshold" {
  description = "Number of platform ERROR log entries over five minutes before the platform alert fires."
  type        = number
  default     = 10
}

variable "observability_ingestion_error_threshold" {
  description = "Number of ingestion ERROR log entries over five minutes before the ingestion alert fires."
  type        = number
  default     = 3
}
