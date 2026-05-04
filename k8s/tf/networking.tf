# ============================================================================
# NETWORKING — Shared VPC, Secondary Ranges, Shared VPC Attachment
# ============================================================================

# ── Secondary IP ranges for GKE pods and services ────────────────────────────
# GKE Autopilot requires two secondary ranges on the subnet.
# These are added to the existing common-apps-subnet in the hub project.

resource "google_compute_subnetwork" "common_apps_with_ranges" {
  project                  = var.hub_project_id
  region                   = var.region
  name                     = data.google_compute_subnetwork.common_apps.name
  ip_cidr_range            = data.google_compute_subnetwork.common_apps.ip_cidr_range
  network                  = data.google_compute_network.shared_vpc.id
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "gke-pods"
    ip_cidr_range = "10.100.0.0/16"
  }

  secondary_ip_range {
    range_name    = "gke-services"
    ip_cidr_range = "10.101.0.0/22"
  }

  # Preserve existing flow logs configuration
  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }

  lifecycle {
    # Terraform import is preferred for this resource since the subnet already exists.
    # Prevents accidental destruction of a shared networking resource.
    prevent_destroy = true
  }
}

# ── Shared VPC service project attachment for GKE project ────────────────────
# Allows p-642-cilab-gke to use subnets from p-642-cilab-infrastructure.

resource "google_compute_shared_vpc_service_project" "gke" {
  host_project    = var.hub_project_id
  service_project = var.gke_project_id
}

# ── Subnet IAM — allow GKE service agents to use the shared subnet ───────────

resource "google_compute_subnetwork_iam_member" "gke_robot_network_user" {
  project    = var.hub_project_id
  region     = var.region
  subnetwork = data.google_compute_subnetwork.common_apps.name
  role       = "roles/compute.networkUser"
  member     = "serviceAccount:service-${data.google_project.gke.number}@container-engine-robot.iam.gserviceaccount.com"

  depends_on = [google_project_service.gke_container]
}

resource "google_compute_subnetwork_iam_member" "gke_cloudservices_network_user" {
  project    = var.hub_project_id
  region     = var.region
  subnetwork = data.google_compute_subnetwork.common_apps.name
  role       = "roles/compute.networkUser"
  member     = "serviceAccount:${data.google_project.gke.number}@cloudservices.gserviceaccount.com"
}

resource "google_project_iam_member" "gke_host_agent" {
  project = var.hub_project_id
  role    = "roles/container.hostServiceAgentUser"
  member  = "serviceAccount:service-${data.google_project.gke.number}@container-engine-robot.iam.gserviceaccount.com"

  depends_on = [google_project_service.gke_container]
}

# ── Cloud DNS — private zone for AlloyDB PSC resolution ──────────────────────
# The AlloyDB Auth Proxy (--psc mode) resolves the PSC DNS name via Cloud DNS.
# Without this zone, pods resolve the Google-internal PSC IP (100.64.x.x) which
# is unreachable from the VPC. The A record maps the DNS name → 10.1.0.10.

resource "google_dns_managed_zone" "alloydb_psc" {
  project     = var.hub_project_id
  name        = "alloydb-psc"
  dns_name    = "alloydb-psc.goog."
  description = "Private zone — resolves AlloyDB PSC DNS names to VPC forwarding rule IPs"
  visibility  = "private"

  private_visibility_config {
    networks {
      network_url = data.google_compute_network.shared_vpc.id
    }
  }

  depends_on = [google_project_service.hub_dns]
}

resource "google_dns_record_set" "alloydb_knowledge_psc" {
  project      = var.hub_project_id
  name         = "c0b844b4-95f2-4300-9167-d24ecea0ad35.d62a1b11-a89a-49bf-8144-49643195eaf3.us-west1.alloydb-psc.goog."
  managed_zone = google_dns_managed_zone.alloydb_psc.name
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_forwarding_rule.alloydb_psc.ip_address]
}
