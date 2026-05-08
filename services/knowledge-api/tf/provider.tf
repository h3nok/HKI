provider "google" {
  project = var.spoke_project_id
}

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.22.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}
