# ============================================================================
# GKE AUTOPILOT CLUSTER
# ============================================================================
# Private Autopilot cluster in p-642-cilab-gke using the Shared VPC from
# p-642-cilab-infrastructure. Nodes have no external IPs; egress via Cloud NAT
# (cilab-nat-us-west1 on cilab-router-us-west1 — already provisioned in hub).

# ── Node service account ──────────────────────────────────────────────────────
# Minimal SA for GKE nodes. Per-workload GCP identities are handled via WIF
# (iam.tf), not via this node SA.

resource "google_service_account" "gke_node" {
  provider     = google.gke
  project      = var.gke_project_id
  account_id   = "gke-node-sa"
  display_name = "GKE Node Service Account"
}

resource "google_project_iam_member" "node_log_writer" {
  provider = google.gke
  project  = var.gke_project_id
  role     = "roles/logging.logWriter"
  member   = "serviceAccount:${google_service_account.gke_node.email}"
}

resource "google_project_iam_member" "node_metric_writer" {
  provider = google.gke
  project  = var.gke_project_id
  role     = "roles/monitoring.metricWriter"
  member   = "serviceAccount:${google_service_account.gke_node.email}"
}

resource "google_project_iam_member" "node_monitoring_viewer" {
  provider = google.gke
  project  = var.gke_project_id
  role     = "roles/monitoring.viewer"
  member   = "serviceAccount:${google_service_account.gke_node.email}"
}

# Allow node SA to pull images from Artifact Registry (hub project)
resource "google_project_iam_member" "node_ar_reader" {
  project = var.hub_project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.gke_node.email}"
}

# ── GKE Autopilot cluster ─────────────────────────────────────────────────────

resource "google_container_cluster" "cilab_platform" {
  provider = google.gke
  project  = var.gke_project_id

  name     = var.cluster_name
  location = var.region

  enable_autopilot = true

  # Shared VPC networking
  network    = "projects/${var.hub_project_id}/global/networks/cilab-shared-vpc"
  subnetwork = "projects/${var.hub_project_id}/regions/${var.region}/subnetworks/common-apps-subnet"

  ip_allocation_policy {
    cluster_secondary_range_name  = "gke-pods"
    services_secondary_range_name = "gke-services"
  }

  # Private nodes — no external IPs, egress via Cloud NAT in hub
  private_cluster_config {
    enable_private_nodes    = true
    master_ipv4_cidr_block  = var.master_ipv4_cidr
    enable_private_endpoint = false # Public master endpoint for kubectl access
  }

  release_channel {
    channel = "REGULAR"
  }

  # Workload Identity — enables per-pod GCP SA via iam.gke.io/gcp-service-account annotation
  workload_identity_config {
    workload_pool = "${var.gke_project_id}.svc.id.goog"
  }

  deletion_protection = false

  depends_on = [
    google_compute_shared_vpc_service_project.gke,
    google_compute_subnetwork_iam_member.gke_robot_network_user,
    google_compute_subnetwork_iam_member.gke_cloudservices_network_user,
    google_project_iam_member.gke_host_agent,
    google_project_service.gke_container,
  ]
}
