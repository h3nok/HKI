# HKI Kubernetes Reference Architecture

Status: public-safe reference architecture. This is not the live deployment
tree.

This document describes how to run HKI-aligned agentic systems on Kubernetes
without publishing private project IDs, registry paths, Terraform state,
cluster names, service account bindings, or customer-specific configuration.

The runnable starter lives in
[`examples/reference-k8s`](../examples/reference-k8s/). It creates the service
shape developers need, using placeholder containers that can be replaced with
their own implementation images.

## Architecture Shape

The reference stack separates runtime traffic into explicit planes:

| Plane         | Kubernetes service   | Default port | Responsibility                                   |
| ------------- | -------------------- | -----------: | ------------------------------------------------ |
| Experience    | `agentic-bff`        |         9001 | UI/BFF, sessions, auth, edge envelope handling   |
| Agent runtime | `orchestrator`       |         9501 | Agent loop, tool choice, model/tool policy       |
| Knowledge     | `knowledge-api`      |         9509 | Retrieval, citations, artifact visibility checks |
| Ingestion     | `ingestion-pipeline` |         9508 | Document intake, chunking, metadata, publication |
| Telemetry     | `analytics`          |         9512 | Usage, audit summaries, operational events       |

External dependencies are intentionally left as implementation choices:

- MySQL or equivalent app database for the BFF state store.
- Vector store or AlloyDB/pgvector-compatible database for knowledge.
- Redis-compatible cache for runtime and job state.
- Object storage for source documents and generated artifacts.
- Secret manager or sealed secret workflow for runtime credentials.
- Model gateway and MCP gateway endpoints selected by the adopter.

## Developer Workflow

### 1. Smoke the Kubernetes shape locally

Use a local cluster such as kind, minikube, Docker Desktop Kubernetes, or a dev
namespace in an existing cluster.

```bash
kubectl apply -k examples/reference-k8s
kubectl -n hki-reference get pods,svc
kubectl -n hki-reference port-forward svc/agentic-bff 9001:9001
curl http://127.0.0.1:9001
```

The starter uses unprivileged placeholder HTTP containers. This proves that the
namespace, services, labels, service account, example secret, and network policy
render and run before a developer plugs in real HKI implementations.

### 2. Replace placeholder images

Copy `examples/reference-k8s` into your deployment repo or use it as a Kustomize
base. Replace each image in `kustomization.yaml` with your own build output:

```yaml
images:
  - name: hki-reference-agentic-bff
    newName: ghcr.io/your-org/agentic-bff
    newTag: 0.1.0
  - name: hki-reference-orchestrator
    newName: ghcr.io/your-org/orchestrator
    newTag: 0.1.0
```

Repeat for `knowledge-api`, `ingestion-pipeline`, and `analytics` if those
services are part of your stack.

### 3. Replace example secrets

`examples/reference-k8s/secrets.example.yaml` exists only so local developers can
apply the stack without additional tooling. Do not use those values in a shared
or production cluster.

Production deployments should source equivalent keys from a real secret system,
for example External Secrets Operator, Sealed Secrets, SOPS, cloud Secret
Manager, or a platform-owned secret injector.

### 4. Wire infrastructure dependencies

The public reference uses neutral environment names so different organizations
can map them to their own infrastructure:

| Variable              | Expected meaning                                           |
| --------------------- | ---------------------------------------------------------- |
| `DATABASE_URL`        | BFF state database. Use MySQL for the Agentic BFF pattern. |
| `ALLOYDB_URL`         | Knowledge/vector database connection string.               |
| `REDIS_URL`           | Runtime cache, chat state, job status, and coordination.   |
| `OBJECT_STORE_BUCKET` | Source documents and generated artifacts.                  |
| `MODEL_GATEWAY_URL`   | Approved model gateway endpoint.                           |
| `MCP_GATEWAY_URL`     | Approved tool gateway endpoint.                            |

Keep runtime routes fail-closed: missing envelope means unauthorized, wildcard or
empty domain is invalid, and body/query scope cannot override the signed HKI
envelope.

## Production Hardening Checklist

- Replace every placeholder image with signed, pinned images.
- Replace `secrets.example.yaml` with a managed secret source.
- Add ingress only at the intended edge; keep internal services ClusterIP.
- Enforce workload identity or equivalent cloud identity for pods.
- Use network policies to restrict runtime-to-admin and cross-plane traffic.
- Add resource requests, limits, HPAs, and pod disruption budgets per service.
- Add probe routes that exercise HKI envelope validation, scope override
  rejection, artifact visibility, cache scoping, and MCP gateway target checks.
- Emit audit events with org, subject, active domain, operation, decision, and
  evidence profile.
- Keep Terraform state, tfvars, live project IDs, registry paths, and cluster
  credentials outside public repositories.

## What Stays Private

The private deployment tree can remain useful internally, but it should not be
copied into a public standard repo. Keep these private or regenerate them from
sanitized templates:

- Terraform state and tfvars.
- Live cloud project IDs and cluster names.
- Private Artifact Registry or container registry URLs.
- Workload Identity service account bindings.
- Secret Manager paths and secret names tied to a real tenant or environment.
- Internal IP addresses, PSC endpoints, load balancer names, and DNS names.
