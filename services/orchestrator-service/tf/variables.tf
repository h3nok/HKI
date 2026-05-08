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

variable "litellm_gateway_url" {
  description = "URL of the LiteLLM gateway for LLM access"
  type        = string
  default     = "https://aigateway.cilabs.np.cc-hki.com/v1"
}

variable "knowledge_api_url" {
  description = "URL of the Knowledge API (MCP server)"
  type        = string
  default     = "http://knowledge-api:8080"
}

variable "vertex_ai_location" {
  description = "GCP location for Vertex AI model calls (may differ from Cloud Run region)"
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
