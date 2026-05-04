terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.22.0"
    }
  }
}

provider "google" {
  project = var.spoke_project_id
  region  = var.region
}
