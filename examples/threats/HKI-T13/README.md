# HKI-T13 — Envelope downgrade to older `hki_version`

A runtime accepts envelopes with `hki_version="0.9"` (or any version other
than the current one). An attacker can therefore downgrade-attack: present an
old envelope format that lacks fields the current code relies on
(`policy_pack_id`, etc.), bypassing newer policy enforcement.
