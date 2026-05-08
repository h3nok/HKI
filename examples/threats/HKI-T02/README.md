# HKI-T02 — Body-parameter scope override

**Severity:** High

A handler accepts a request body field (`scope`, `stream_id`, `domain`) that
overrides the signed HKI envelope's `active_domain`. A caller with a valid
envelope for one domain can read another by setting the body field.

Conformance: HKI-C20..C24.
