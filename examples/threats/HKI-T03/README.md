# HKI-T03 — Implicit `or "global"` fallback

**Severity:** High

A repository reads `domain` from context with `or "global"` — when the
envelope is missing or null the call silently runs as global and reads every
domain. Detected statically by `audit:hki` and at runtime by
`is_forbidden_runtime_domain`.

Conformance: HKI-C03, HKI-C04.
