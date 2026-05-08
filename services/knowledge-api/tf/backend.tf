terraform {
  backend "gcs" {
    bucket = "gcp-gcs-cicd-core-cilab-deploy"
    prefix = "lab/apps/knowledge-api"
  }
}
