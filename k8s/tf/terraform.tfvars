hub_project_id   = "p-642-cilab-infrastructure"
spoke_project_id = "p-642-cilab-demo"
gke_project_id   = "p-642-cilab-gke"
region           = "us-west1"
cluster_name     = "cilab-platform"
k8s_namespace    = "platform"
master_ipv4_cidr = "172.16.0.32/28"

# Redis: 1GB is sufficient for dev/staging; bump to 5 for production traffic
redis_memory_size_gb = 1
