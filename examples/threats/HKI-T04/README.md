# HKI-T04 — Async job loses domain on resume

**Severity:** High
**Surface:** Runtime / async jobs (Pub/Sub, SQS, Celery, RQ, Cloud Tasks).

A job is enqueued under a request envelope, but the worker that resumes it
re-mints (or omits) the envelope and runs as `global` or as a service
account. The artifact written by the job is therefore unlabeled or labeled
with the wrong domain.

Conformance: HKI-C03, HKI-C09 (cache-key binding), HKI-C19 (artifact label).
