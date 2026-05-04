# AI Platform Observability

Production observability is GCP-native.

## Services

- Cloud Logging: structured JSON logs from GKE workloads.
- Cloud Trace: distributed traces from Python services when `OTEL_ENABLED=true` and `GCP_PROJECT_ID` is set.
- Cloud Monitoring: dashboards, log-based metrics, and alert policies.
- BigQuery analytics: durable AI usage, KB, tool, guardrail, and audit events.

## Terraform

The GKE platform stack provisions the shared observability surface in `apps/ai-platform/k8s/tf/observability.tf`:

- enables `logging.googleapis.com`, `monitoring.googleapis.com`, and `cloudtrace.googleapis.com` in the spoke and GKE projects
- creates log-based metrics for platform errors, LLM trace events, guardrail blocks, and ingestion failures
- creates the `AI Platform - GCP Observability` Cloud Monitoring dashboard
- creates alert policies for elevated platform errors and ingestion failures

Notification channels are intentionally configurable through `observability_notification_channel_ids` so each environment can decide whether alerts page, email, or stay dashboard-only.

Use the repo scripts and Make targets for bootstrap, validation, planning, and apply:

```bash
make observability-validate
make observability-bootstrap
make observability-plan
OBSERVABILITY_NOTIFICATION_CHANNEL_IDS='projects/p-642-cilab-gke/notificationChannels/CHANNEL_ID' make observability-plan
make observability-apply
```

`make observability-plan` and `make observability-apply` use the same `scripts/gke-terraform.sh` bootstrap path as the canonical GKE deployment script, so provider initialization and backend handling stay consistent with `make gke-plan`, `make gke-infra`, and `make gke-deploy`.

## Operator Flow

1. Open the Cloud Monitoring dashboard from the Agentic UI Observability link.
2. If an alert or chart indicates a spike, open Cloud Logging filtered to `resource.labels.namespace_name="platform"`.
3. Use the `logging.googleapis.com/trace` field on structured log entries to pivot into Cloud Trace.
4. Use BigQuery analytics for longer-range AI usage, tool call, guardrail, and KB quality reporting.

## Runtime Notes

The Python services export traces directly to Cloud Trace through `shared.tracing`; no in-cluster OpenTelemetry collector is required for the current architecture. `OTEL_EXPORTER_ENDPOINT` remains available for future collector-based routing, but production ConfigMaps leave it empty.
