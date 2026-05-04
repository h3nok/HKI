# ============================================================================
# SECRET MANAGEMENT
# ============================================================================
# Secure storage for database credentials and API keys

# Generate a secure random JWT secret for inter-service authentication
resource "random_password" "service_auth_secret" {
  length  = 64
  special = true
}

# Secret for database password
resource "google_secret_manager_secret" "db_password" {
  secret_id = "knowledge-api-db-password"
  project   = var.spoke_project_id

  replication {
    auto {}
  }
}

# Store the database password in Secret Manager
resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# Secret for AlloyDB connection URL
resource "google_secret_manager_secret" "alloydb_url" {
  secret_id = "knowledge-api-alloydb-url"
  project   = var.spoke_project_id

  replication {
    auto {}
  }
}

# Store the AlloyDB URL in Secret Manager
# Format: postgresql://user:password@psc-endpoint-ip:5432/database
# Note: Database 'knowledge' will be created by application on first startup
# For PSC-enabled AlloyDB, use the PSC endpoint IP address
resource "google_secret_manager_secret_version" "alloydb_url" {
  secret      = google_secret_manager_secret.alloydb_url.id
  secret_data = "postgresql://postgres:${urlencode(random_password.db_password.result)}@${google_compute_address.db_psc_endpoint.address}:5432/knowledge?sslmode=require"
}

# Secret for service authentication JWT secret
resource "google_secret_manager_secret" "service_auth_secret" {
  secret_id = "knowledge-api-service-auth-secret"
  project   = var.spoke_project_id

  replication {
    auto {}
  }
}

# Store the service auth secret in Secret Manager (auto-generated)
resource "google_secret_manager_secret_version" "service_auth_secret" {
  secret      = google_secret_manager_secret.service_auth_secret.id
  secret_data = random_password.service_auth_secret.result
}

# Secret for embedding API key (LiteLLM)
resource "google_secret_manager_secret" "embedding_api_key" {
  secret_id = "knowledge-api-embedding-key"
  project   = var.spoke_project_id

  replication {
    auto {}
  }
}
