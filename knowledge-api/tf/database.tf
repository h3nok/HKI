# ============================================================================
# ALLOYDB INFRASTRUCTURE
# ============================================================================
# AlloyDB cluster and instance with Private Service Connect (PSC) enabled

# Get project data for project numbers (needed for PSC allowed consumers)
data "google_project" "spoke" {
  project_id = var.spoke_project_id
}

data "google_project" "hub" {
  project_id = var.hub_project_id
}

data "google_project" "gke" {
  project_id = var.gke_project_id
}

# Generate a secure random password for the database
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# AlloyDB cluster with Private Service Connect enabled
resource "google_alloydb_cluster" "knowledge_cluster" {
  cluster_id   = "knowledge-cluster"
  location     = var.region
  project      = var.spoke_project_id
  
  # Enable PSC instead of using network_config
  psc_config {
    psc_enabled = true
  }

  # Create initial postgres user
  initial_user {
    user     = "postgres"
    password = random_password.db_password.result
  }

  # Enable automated backups
  automated_backup_policy {
    enabled = true
    backup_window = "7200s"  # 2 hour backup window
    location      = var.region
    
    weekly_schedule {
      days_of_week = ["MONDAY", "WEDNESDAY", "FRIDAY"]
      start_times {
        hours   = 3
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }

  deletion_protection = false

  depends_on = [
    google_project_service.alloydb
  ]
}

# AlloyDB primary instance with PSC configuration
resource "google_alloydb_instance" "knowledge_primary" {
  cluster       = google_alloydb_cluster.knowledge_cluster.name
  instance_id   = "knowledge-primary"
  instance_type = "PRIMARY"

  machine_config {
    cpu_count = 2
  }

  # Database flags for AlloyDB (pgvector is enabled via CREATE EXTENSION in schema.sql)
  database_flags = {
    "max_connections" = "200"
  }

  # PSC instance configuration
  psc_instance_config {
    allowed_consumer_projects = [
      data.google_project.spoke.number,
      data.google_project.hub.number,
      data.google_project.gke.number,
    ]
  }

  depends_on = [google_alloydb_cluster.knowledge_cluster]
}

# Note: Database 'knowledge' will be created by the application on first startup
# The app connects as 'postgres' user and runs schema.sql which creates:
# - knowledge database, pgvector extension, tables, indexes, RLS policies
