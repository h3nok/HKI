# ============================================================================
# GCP-NATIVE OBSERVABILITY
# ============================================================================
# Production observability uses Google Cloud Operations:
#   - Cloud Logging for structured service logs and log-based metrics
#   - Cloud Trace for distributed request traces from the shared tracing module
#   - Cloud Monitoring for dashboards and alert policies
#   - BigQuery analytics remains the durable AI event store

locals {
  observability_services = toset([
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "cloudtrace.googleapis.com",
  ])
}

resource "google_project_service" "spoke_observability" {
  provider           = google.spoke
  for_each           = local.observability_services
  project            = var.spoke_project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_project_service" "gke_observability" {
  provider           = google.gke
  for_each           = local.observability_services
  project            = var.gke_project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_logging_metric" "platform_error_count" {
  provider = google.gke
  project  = var.gke_project_id
  name     = "ai_platform_error_count"
  filter   = <<-EOT
    resource.type="k8s_container"
    resource.labels.namespace_name="${var.k8s_namespace}"
    severity>=ERROR
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"

    labels {
      key         = "service"
      value_type  = "STRING"
      description = "Kubernetes container name"
    }
  }

  label_extractors = {
    service = "EXTRACT(resource.labels.container_name)"
  }

  depends_on = [google_project_service.gke_observability]
}

resource "google_logging_metric" "llm_trace_count" {
  provider = google.gke
  project  = var.gke_project_id
  name     = "ai_platform_llm_trace_count"
  filter   = <<-EOT
    resource.type="k8s_container"
    resource.labels.namespace_name="${var.k8s_namespace}"
    jsonPayload.log_type="llm_trace"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"

    labels {
      key         = "operation"
      value_type  = "STRING"
      description = "Observed LLM or retrieval operation"
    }
  }

  label_extractors = {
    operation = "EXTRACT(jsonPayload.operation)"
  }

  depends_on = [google_project_service.gke_observability]
}

resource "google_logging_metric" "guardrail_block_count" {
  provider = google.gke
  project  = var.gke_project_id
  name     = "ai_platform_guardrail_block_count"
  filter   = <<-EOT
    resource.type="k8s_container"
    resource.labels.namespace_name="${var.k8s_namespace}"
    jsonPayload.event_type="guardrail.block"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }

  depends_on = [google_project_service.gke_observability]
}

resource "google_logging_metric" "ingestion_failure_count" {
  provider = google.gke
  project  = var.gke_project_id
  name     = "ai_platform_ingestion_failure_count"
  filter   = <<-EOT
    resource.type="k8s_container"
    resource.labels.namespace_name="${var.k8s_namespace}"
    (resource.labels.container_name="ingestion-pipeline" OR resource.labels.container_name="ingestion-pipeline-worker")
    severity>=ERROR
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }

  depends_on = [google_project_service.gke_observability]
}

resource "google_monitoring_dashboard" "ai_platform" {
  provider = google.gke
  project  = var.gke_project_id

  dashboard_json = jsonencode({
    displayName = "AI Platform - GCP Observability"
    gridLayout = {
      columns = 2
      widgets = [
        {
          title = "Platform errors"
          scorecard = {
            timeSeriesQuery = {
              timeSeriesFilter = {
                filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.platform_error_count.name}\""
                aggregation = {
                  alignmentPeriod    = "300s"
                  perSeriesAligner   = "ALIGN_DELTA"
                  crossSeriesReducer = "REDUCE_SUM"
                }
              }
            }
          }
        },
        {
          title = "Ingestion failures"
          scorecard = {
            timeSeriesQuery = {
              timeSeriesFilter = {
                filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.ingestion_failure_count.name}\""
                aggregation = {
                  alignmentPeriod    = "300s"
                  perSeriesAligner   = "ALIGN_DELTA"
                  crossSeriesReducer = "REDUCE_SUM"
                }
              }
            }
          }
        },
        {
          title = "LLM trace events by operation"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.llm_trace_count.name}\""
                  aggregation = {
                    alignmentPeriod    = "300s"
                    perSeriesAligner   = "ALIGN_DELTA"
                    crossSeriesReducer = "REDUCE_SUM"
                    groupByFields      = ["metric.label.operation"]
                  }
                }
              }
              plotType = "LINE"
            }]
            timeshiftDuration = "0s"
            yAxis = {
              label = "events"
              scale = "LINEAR"
            }
          }
        },
        {
          title = "Guardrail blocks"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.guardrail_block_count.name}\""
                  aggregation = {
                    alignmentPeriod    = "300s"
                    perSeriesAligner   = "ALIGN_DELTA"
                    crossSeriesReducer = "REDUCE_SUM"
                  }
                }
              }
              plotType = "LINE"
            }]
            timeshiftDuration = "0s"
            yAxis = {
              label = "blocks"
              scale = "LINEAR"
            }
          }
        },
      ]
    }
  })

  depends_on = [google_project_service.gke_observability]
}

resource "google_monitoring_alert_policy" "platform_errors" {
  provider     = google.gke
  project      = var.gke_project_id
  display_name = "AI Platform - elevated service errors"
  combiner     = "OR"

  conditions {
    display_name = "Platform ERROR logs exceed threshold"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.platform_error_count.name}\" resource.type=\"k8s_container\""
      comparison      = "COMPARISON_GT"
      threshold_value = var.observability_platform_error_threshold
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = var.observability_notification_channel_ids

  documentation {
    content   = "AI Platform services are emitting elevated ERROR logs. Start with Cloud Logging filtered to namespace ${var.k8s_namespace}, then pivot to Cloud Trace using the trace field on correlated log entries."
    mime_type = "text/markdown"
  }

  depends_on = [google_project_service.gke_observability]
}

resource "google_monitoring_alert_policy" "ingestion_failures" {
  provider     = google.gke
  project      = var.gke_project_id
  display_name = "AI Platform - ingestion failures"
  combiner     = "OR"

  conditions {
    display_name = "Ingestion ERROR logs exceed threshold"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.ingestion_failure_count.name}\" resource.type=\"k8s_container\""
      comparison      = "COMPARISON_GT"
      threshold_value = var.observability_ingestion_error_threshold
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = var.observability_notification_channel_ids

  documentation {
    content   = "Knowledge ingestion is failing above the configured threshold. Check ingestion-pipeline and ingestion-pipeline-worker logs, then inspect the corresponding job IDs in Agentic."
    mime_type = "text/markdown"
  }

  depends_on = [google_project_service.gke_observability]
}

output "observability_dashboard_url" {
  description = "Cloud Monitoring dashboard list for the GKE observability project"
  value       = "https://console.cloud.google.com/monitoring/dashboards?project=${var.gke_project_id}"
}
