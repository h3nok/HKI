# ============================================================================
# DATABASE — AlloyDB PSC Consumer Configuration
# ============================================================================
# The AlloyDB cluster (knowledge-cluster) already exists in p-642-cilab-demo.
# This file manages the PSC consumer side: forwarding rule + allowed projects.
#
# PSC forwarding rule lives in p-642-cilab-infrastructure (VPC host project)
# because Shared VPC networks and their subnets are owned by the host project.

# ── Static IP for AlloyDB PSC endpoint ───────────────────────────────────────

resource "google_compute_address" "alloydb_psc_ip" {
  project      = var.hub_project_id
  name         = "alloydb-knowledge-psc-ip"
  region       = var.region
  subnetwork   = data.google_compute_subnetwork.common_apps.id
  address_type = "INTERNAL"
  address      = "10.1.0.10"
}

# ── PSC forwarding rule → AlloyDB service attachment ─────────────────────────

resource "google_compute_forwarding_rule" "alloydb_psc" {
  project               = var.hub_project_id
  name                  = "alloydb-knowledge-psc"
  region                = var.region
  network               = data.google_compute_network.shared_vpc.id
  subnetwork            = data.google_compute_subnetwork.common_apps.id
  ip_address            = google_compute_address.alloydb_psc_ip.id
  target                = "https://www.googleapis.com/compute/v1/projects/x17b31e41a608c04dp-tp/regions/${var.region}/serviceAttachments/alloydb-c0b844b4-95f-knowledge-primar-sa"
  load_balancing_scheme = ""
}

# ── AlloyDB PSC allowed consumer projects ────────────────────────────────────
# Grants p-642-cilab-infrastructure and p-642-cilab-gke the right to create
# PSC endpoints to this AlloyDB instance. Managed via REST API since gcloud
# alloydb does not expose this field.
#
# This is implemented as a null_resource that calls the AlloyDB REST API;
# once google provider supports pscInstanceConfig.allowedConsumerProjects,
# migrate to a native google_alloydb_instance resource update.

resource "null_resource" "alloydb_psc_consumers" {
  triggers = {
    hub_project_number  = data.google_project.hub.number
    gke_project_number  = data.google_project.gke.number
    spoke_project_number = data.google_project.spoke.number
  }

  provisioner "local-exec" {
    command = <<-EOT
      ACCESS_TOKEN=$(gcloud auth print-access-token)
      curl -s -X PATCH \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        "https://alloydb.googleapis.com/v1/projects/${var.spoke_project_id}/locations/${var.region}/clusters/knowledge-cluster/instances/knowledge-primary?updateMask=pscInstanceConfig.allowedConsumerProjects" \
        -d '{
          "pscInstanceConfig": {
            "allowedConsumerProjects": [
              "${self.triggers.spoke_project_number}",
              "${self.triggers.hub_project_number}",
              "${self.triggers.gke_project_number}"
            ]
          }
        }'
    EOT
  }

  depends_on = [google_compute_forwarding_rule.alloydb_psc]
}
