# hki-conformance

HKI 1.0 conformance fixtures, adapter protocol, and certification runner for Python.

Mirrors `@hki/conformance` (TypeScript). Run the 28-case suite against any Python adapter to verify it enforces the HKI standard correctly.

## Install

```bash
pip install hki-conformance
```

## CLI

```bash
# Run against the reference hki_runtime adapter
hki-conformance

# Run against a custom adapter
hki-conformance --adapter mypackage.adapter:MyAdapter

# Require at least conformance level 3, write JSON evidence
hki-conformance --min-level 3 --output conformance.json
```

## pytest integration

```python
import pytest
from hki_conformance import HKI_CONFORMANCE_CASES, run_conformance
from mypackage import MyAdapter

@pytest.mark.parametrize("case", HKI_CONFORMANCE_CASES, ids=[c["id"] for c in HKI_CONFORMANCE_CASES])
def test_conformance(case):
    result = case["run"](MyAdapter(), now=None)
    assert result["passed"], f"{result['id']}: {result['actual']}"
```

## Conformance levels

| Level | Name | What passes |
|-------|------|-------------|
| L0 | None | No must-cases pass |
| L1 | Structural | L1 must-cases pass |
| L2 | Envelope | L1–L2 must-cases pass |
| L3 | Isolation | L1–L3 must-cases pass |
| L4 | Probed | L1–L4 must-cases pass |
