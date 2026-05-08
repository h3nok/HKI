# HKI-T12 — Expired envelope accepted (clock skew abuse)

A runtime never compares `expires_at` against the current time, or trusts an
attacker-supplied `now` parameter. Envelopes whose `expires_at` is in the past
are accepted.
