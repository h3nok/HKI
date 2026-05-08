# Hub project (where shared VPC and infrastructure lives)
hub_project_id = "p-642-cilab-infrastructure"

# Spoke project (where this app will be deployed)
spoke_project_id = "p-642-cilab-demo"

# RETIRED: legacy Cloud Run tfvars kept only for break-glass recovery.
# The canonical production runtime is GKE, and the old run.app services were deleted.

# Region for deployment
region = "us-west1"

# Knowledge API URL must be set explicitly only if doing break-glass legacy Cloud Run work.
knowledge_api_url = ""

# GCS bucket for document uploads
gcs_bucket_name = "cilab-demo-knowledge-documents"

# Vertex AI location for direct LLM calls
vertex_ai_location = "us-central1"
