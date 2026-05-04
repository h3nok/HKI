output "cluster_name" {
  description = "GKE Autopilot cluster name"
  value       = google_container_cluster.cilab_platform.name
}

output "cluster_endpoint" {
  description = "GKE cluster master endpoint"
  value       = google_container_cluster.cilab_platform.endpoint
  sensitive   = true
}

output "cluster_location" {
  description = "GKE cluster region"
  value       = google_container_cluster.cilab_platform.location
}

output "workload_identity_pool" {
  description = "WIF pool for k8s service account impersonation"
  value       = "${var.gke_project_id}.svc.id.goog"
}

output "alloydb_psc_ip" {
  description = "PSC forwarding rule IP for AlloyDB (resolves via Cloud DNS)"
  value       = google_compute_address.alloydb_psc_ip.address
}

output "gke_credentials_command" {
  description = "Command to configure local kubectl"
  value       = "gcloud container clusters get-credentials ${var.cluster_name} --region=${var.region} --project=${var.gke_project_id}"
}
