# hki-autogen

HKI integration for Microsoft AutoGen (v0.4 / `autogen-core` + `autogen-agentchat`).

Provides:

- `HkiMessageGuard` — duck-typed message validator that rejects messages
  whose `metadata` is missing a signed HKI envelope or whose body
  contains a scope-override field.
- `HkiToolWrapper` — wraps any callable tool used by an `AssistantAgent`;
  enforces the envelope on every invocation.
- `HkiAgentMixin` — mixin you can drop onto a custom `BaseChatAgent`
  subclass to fail-closed when the inbound message stream lacks an
  envelope.
- `hki_cache_key` — derives a domain-bound cache key.

Usage:

```python
from hki_autogen import HkiMessageGuard, HkiToolWrapper

guard = HkiMessageGuard()
guard.assert_message_authorized(message)

safe_tool = HkiToolWrapper(my_tool, envelope=signed_envelope)
```

See [docs/HKI_ROADMAP.md](../../docs/HKI_ROADMAP.md) (M16).
