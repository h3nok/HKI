# HKI Threat Demos

Each subdirectory `HKI-T01`, `HKI-T02`, … is a **runnable** proof of one
threat in [docs/HKI_THREATS.md](../../docs/HKI_THREATS.md).

Every threat directory contains:

- `README.md` — the threat, severity, and how to reproduce.
- `pre_hki.py` (or `.ts`) — the failure mode running without HKI.
- `post_hki.py` (or `.ts`) — the same code with HKI applied; fails closed.
- `test_threat.py` — pytest verifying both the leak (pre) and the block (post).

These examples are deliberately minimal (≤80 LOC each). They are the
"break a RAG in 60 seconds" demo set referenced in milestone M22.

## Running

```bash
cd examples/threats/HKI-T01
python pre_hki.py     # demonstrates the leak
python post_hki.py    # demonstrates the block
pytest test_threat.py # asserts both
```

The shared `hki_runtime` package must be installed:

```bash
pip install -e packages/hki-runtime-py
```
