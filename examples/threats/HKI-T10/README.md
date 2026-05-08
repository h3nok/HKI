# HKI-T10 — Wildcard publication into runtime domain

A publisher writes artifacts with `active_domain="*"` (or `"global"`) so that
"every tenant can read them." Any runtime read that filters by domain therefore
sees these artifacts, regardless of authorization.
