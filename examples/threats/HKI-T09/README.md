# HKI-T09 — Admin route reachable from runtime envelope

A handler exposed for both runtime and admin operations differentiates by URL
prefix, but does not check `purpose` / `risk_tier` on the envelope. A runtime
envelope (e.g. `purpose=chat`, `risk_tier=read-only`) can therefore POST to an
admin route and trigger destructive operations.

Run:

```bash
python pre_hki.py    # leaks: deletes the index under a chat envelope
python post_hki.py   # blocks: rejects non-admin envelope at admin route
```
