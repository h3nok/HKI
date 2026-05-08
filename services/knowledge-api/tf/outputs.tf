output "service_name" {
  description = "The name of the deployed Cloud Run service"
  value       = google_cloud_run_v2_service.knowledge_api.name
}

output "service_url" {
  description = "The URL of the deployed Cloud Run service"
  value       = google_cloud_run_v2_service.knowledge_api.uri
}

output "region" {
  description = "The region where the service is deployed"
  value       = google_cloud_run_v2_service.knowledge_api.location
}

output "project_id" {
  description = "The project ID where the service is deployed"
  value       = google_cloud_run_v2_service.knowledge_api.project
}

output "alloydb_cluster_name" {
  description = "The AlloyDB cluster name"
  value       = google_alloydb_cluster.knowledge_cluster.name
}

output "alloydb_instance_name" {
  description = "The AlloyDB instance name"
  value       = google_alloydb_instance.knowledge_primary.name
}

output "alloydb_instance_ip" {
  description = "The AlloyDB instance IP address"
  value       = google_alloydb_instance.knowledge_primary.ip_address
}

output "database_user" {
  description = "The database user (postgres)"
  value       = "postgres"
  sensitive   = true
}

output "service_account_email" {
  description = "The Cloud Run service account email"
  value       = data.google_service_account.cloudrun_sa.email
}
