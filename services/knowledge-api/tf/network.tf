# ============================================================================
# PRIVATE SERVICE CONNECT ENDPOINT FOR ALLOYDB
# ============================================================================
# Creates PSC endpoint to connect to AlloyDB from spoke project

# Reserve an IP address in the common-apps subnet for the PSC endpoint
resource "google_compute_address" "db_psc_endpoint" {
  name         = "knowledge-api-db-psc-endpoint"
  address_type = "INTERNAL"
  subnetwork   = data.google_compute_subnetwork.common_apps.id
  region       = var.region
  project      = var.spoke_project_id

  depends_on = [
    google_project_service.compute
  ]
}

# Create the PSC endpoint (forwarding rule) that connects to AlloyDB
resource "google_compute_forwarding_rule" "db_psc_endpoint" {
  name                  = "knowledge-api-db-psc-endpoint"
  region                = var.region
  project               = var.spoke_project_id
  network               = data.google_compute_network.hub_vpc.id
  ip_address            = google_compute_address.db_psc_endpoint.id
  load_balancing_scheme = ""  # Must be empty for PSC
  target                = google_alloydb_instance.knowledge_primary.psc_instance_config[0].service_attachment_link

  depends_on = [
    google_alloydb_instance.knowledge_primary
  ]
}
