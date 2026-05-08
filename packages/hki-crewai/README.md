# hki-crewai

HKI integration for CrewAI.

Provides:

- `HkiTaskGuard` — validates that a CrewAI `Task` carries a signed HKI
  envelope on its `context` (or `inputs`) and that the task description /
  inputs do not contain scope-override fields.
- `HkiToolWrapper` — wraps any CrewAI `BaseTool` (or plain callable);
  enforces the envelope on every `_run` invocation.
- `HkiCrewGuard` — validates that every task in a `Crew` carries the
  same envelope (catches accidental envelope swaps across delegated
  agents).
- `hki_cache_key` — derives a domain-bound cache key.

Usage:

```python
from hki_crewai import HkiTaskGuard, HkiToolWrapper

guard = HkiTaskGuard()
guard.assert_task_authorized(task)

safe_tool = HkiToolWrapper(my_tool, envelope=signed_envelope)
```

See [docs/HKI_ROADMAP.md](../../docs/HKI_ROADMAP.md) (M17).
