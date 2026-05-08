# HKI-T01 — Semantic cache cross-domain leak

**Severity:** Critical

A response cache keyed only by the prompt text (and optionally model name)
returns the wrong tenant's content when two tenants ask the same question.
The LLM is never re-invoked; no observability event records the cross-domain
read.

## Reproduce

```bash
python pre_hki.py     # iris's answer is leaked to pulse
python post_hki.py    # cache misses; HKI key segregates by domain
pytest test_threat.py
```

## Block

`hki_runtime.derive_hki_cache_key` derives a cache key that includes
`org_id`, `active_domain`, `purpose`, and `policy_pack_id`. Cross-domain
keys are guaranteed distinct.

Conformance: HKI-C09, HKI-C10.
