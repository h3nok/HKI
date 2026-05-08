# Hub project (where shared VPC and infrastructure lives)
hub_project_id = "p-642-cilab-infrastructure"

# Spoke project (where this app will be deployed)
spoke_project_id = "p-642-cilab-demo"

# RETIRED: legacy Cloud Run tfvars kept only for break-glass recovery.
# The canonical production runtime is GKE, and the old run.app services were deleted.

# Region for deployment
region = "us-west1"

# LiteLLM gateway URL - use deployed gateway with OpenAI-compatible /v1 path
litellm_gateway_url = "https://aigateway.cilabs.np.cc-hki.com/v1"

# Knowledge API URL must be set explicitly only if doing break-glass legacy Cloud Run work.
knowledge_api_url = ""

# Vertex AI model location (Gemini availability may differ from Cloud Run region)
vertex_ai_location = "us-central1"
