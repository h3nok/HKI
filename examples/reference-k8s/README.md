# HKI Reference K8s Starter

This directory is a public-safe Kubernetes starter for HKI-aligned agentic
systems. It is intentionally generic: it deploys the service topology with
placeholder HTTP containers, then lets adopters replace images and secrets with
their own implementations.

It does not contain live project IDs, private registry paths, Terraform state,
tfvars, customer configuration, or production secrets.

## Quick Start

```bash
kubectl apply -k examples/reference-k8s
kubectl -n hki-reference get pods,svc
kubectl -n hki-reference port-forward svc/agentic-bff 9001:9001
curl http://127.0.0.1:9001
```

Expected services:

| Service              | Port | Purpose                         |
| -------------------- | ---: | ------------------------------- |
| `agentic-bff`        | 9001 | Experience/BFF edge             |
| `orchestrator`       | 9501 | Agent runtime                   |
| `knowledge-api`      | 9509 | Retrieval and artifact checks   |
| `ingestion-pipeline` | 9508 | Upload and publication pipeline |
| `analytics`          | 9512 | Usage and audit telemetry       |

## Replace Images

Edit `kustomization.yaml` and point each logical image at your implementation:

```yaml
images:
  - name: hki-reference-agentic-bff
    newName: ghcr.io/your-org/agentic-bff
    newTag: 0.1.0
```

The default `nginxinc/nginx-unprivileged` images are only placeholders for local
cluster smoke tests.

## Replace Secrets

`secrets.example.yaml` is included in the kustomization for local developer
convenience. Replace it with External Secrets, Sealed Secrets, SOPS, or your
cloud secret manager before using a shared cluster.

## Validate Rendering

```bash
kubectl kustomize examples/reference-k8s >/tmp/hki-reference.yaml
```

Review the rendered output before applying overlays in a real environment.
