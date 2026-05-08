# hki-adk

HKI integration for the Google Agent Development Kit (ADK).

Provides:

- `HkiToolGuard` — wraps any ADK tool callable; enforces a signed HKI
  envelope from the `ToolContext` (or session state) and rejects
  scope-override arguments.
- `HkiBeforeAgentCallback` / `HkiBeforeToolCallback` — drop-in callbacks
  for `LlmAgent` that fail-closed when the envelope is missing or invalid.
- `HkiSessionGuard` — duck-typed session validator that asserts every
  message in a session carries the same envelope.
- `hki_cache_key` — derives a domain-bound cache key.

Usage:

```python
from hki_adk import HkiToolGuard, HkiBeforeAgentCallback
from google.adk.agents import LlmAgent

agent = LlmAgent(
    model="gemini-2.0-flash",
    tools=[HkiToolGuard(my_tool)],
    before_agent_callback=HkiBeforeAgentCallback(),
)
```

See [docs/HKI_ROADMAP.md](../../docs/HKI_ROADMAP.md) (M15).
