# ============================================================================
# AI Platform — GKE Infrastructure
# ============================================================================
# Provisions and wires everything needed for the k8s deployment path:
#   GKE Autopilot cluster, Workload Identity, Memorystore Redis,
#   AlloyDB PSC consumer configuration, Cloud DNS, and IAM bindings.
#
# Projects in use:
#   hub    = p-642-cilab-infrastructure  (shared VPC, Memorystore, DNS, registry)
#   spoke  = p-642-cilab-demo            (AlloyDB, Cloud SQL, Secret Manager, GCP SAs)
#   gke    = p-642-cilab-gke             (GKE cluster, node SA)
# ============================================================================

terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

# ── Providers — one per project ──────────────────────────────────────────────

provider "google" {
  project = var.hub_project_id
  region  = var.region
}

provider "google" {
  alias   = "spoke"
  project = var.spoke_project_id
  region  = var.region
}

provider "google" {
  alias   = "gke"
  project = var.gke_project_id
  region  = var.region
}

provider "google-beta" {
  project = var.hub_project_id
  region  = var.region
}

# ── Data sources ─────────────────────────────────────────────────────────────

data "google_project" "hub" {
  project_id = var.hub_project_id
}

data "google_project" "spoke" {
  provider   = google.spoke
  project_id = var.spoke_project_id
}

data "google_project" "gke" {
  provider   = google.gke
  project_id = var.gke_project_id
}

data "google_compute_network" "shared_vpc" {
  project = var.hub_project_id
  name    = "cilab-shared-vpc"
}

data "google_compute_subnetwork" "common_apps" {
  project = var.hub_project_id
  region  = var.region
  name    = "common-apps-subnet"
}

# ── API enablement ────────────────────────────────────────────────────────────

resource "google_project_service" "gke_container" {
  provider           = google.gke
  project            = var.gke_project_id
  service            = "container.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "gke_iam" {
  provider           = google.gke
  project            = var.gke_project_id
  service            = "iam.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "hub_redis" {
  project            = var.hub_project_id
  service            = "redis.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "hub_dns" {
  project            = var.hub_project_id
  service            = "dns.googleapis.com"
  disable_on_destroy = false
}
