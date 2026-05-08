# HKI-T11 — Envelope replay (no `envelope_id` check)

An attacker captures a valid signed envelope (e.g. via log scraping) and
replays it on later requests. The runtime accepts it because validation
checks signature+expiry but not whether `envelope_id` was already consumed.
