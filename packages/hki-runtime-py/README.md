# hki-runtime

Reference Python runtime helpers for HKI 1.0.

HKI treats runtime scope as a signed envelope, not as a loose query parameter.
This package mirrors the public `@hki/runtime` TypeScript package for Python
gateways, FastAPI services, retrieval adapters, memory stores, caches, and MCP
tool routers.

> **Security scope of this library**
>
> `validate_envelope` checks structural correctness, expiry, domain validity,
> and claim consistency. It does **not** perform cryptographic signature
> verification (Ed25519/JWS). Cryptographic verification is the responsibility
> of the **gateway or issuer** that mints the envelope — it must happen before
> handing the envelope to downstream services. See
> [HKI Agent Gateway Profile](../../spec/HKI-Agent-Gateway-Profile.md) for
> gateway-layer requirements.

## Install

```bash
pip install hki-runtime
```

For local repo development:

```bash
uv run --extra dev pytest
```

## Runtime Envelope

```python
from hki_runtime import validate_envelope

validation = validate_envelope(raw_envelope, require_signature=True)
if not validation.ok:
    raise ValueError("; ".join(issue.message for issue in validation.issues))

envelope = validation.envelope
```

An accepted envelope must have exactly one non-global, non-wildcard
`active_domain`, a non-empty `authorized_domains` set containing that active
domain, valid issue and expiry timestamps, and an optional or required signature
depending on the runtime boundary.

## Artifact Visibility

```python
from hki_runtime import assert_artifact_visible

issue = assert_artifact_visible(
    envelope,
    {
        "org_id": "org_acme",
        "domain": "payments",
        "artifact_type": "document",
        "artifact_id": "doc_123",
    },
)

if issue:
    raise PermissionError(issue.message)
```

Runtime reads must match both `org_id` and `active_domain`. Membership in
`authorized_domains` is not enough to make another domain visible. Artifacts
labeled `global` or `*` are rejected before visibility is evaluated.

## Cache Keys

```python
from hki_runtime import derive_hki_cache_key

key = derive_hki_cache_key(
    {
        "envelope": envelope,
        "operation": "retrieval.search",
        "input": {"query": "refund policy"},
        "model_route": "gpt-5.4",
        "context_version": "kb-v1",
    }
)
```

The derived key includes organization, active domain, purpose, operation, policy
pack, model route, context version, and a stable fingerprint of the input.

## Gateway Targets

```python
from hki_runtime import evaluate_gateway_target, reject_conflicting_scope_argument

override = reject_conflicting_scope_argument(envelope, request_payload)
if override:
    raise PermissionError(override)

decision = evaluate_gateway_target(
    envelope,
    {
        "type": "tool",
        "id": "retrieval.search",
        "domain": "payments",
    },
)

if not decision.allowed:
    raise PermissionError(decision.reason)
```

## Telemetry

```python
from hki_runtime import apply_hki_trace_attributes

apply_hki_trace_attributes(span, envelope)
```

The helper writes standard HKI attributes such as `hki.envelope_id`,
`hki.org_id`, `hki.active_domain`, `hki.purpose`, and `hki.policy_pack_id`.
