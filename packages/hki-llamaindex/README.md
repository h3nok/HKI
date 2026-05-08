# hki-llamaindex

HKI integration for LlamaIndex.

Provides:

- `HkiCallbackHandler` — duck-typed `BaseCallbackHandler` that enforces a
  signed HKI envelope on every event (LLM / retrieve / query / agent_step
  / function_call) and rejects scope-override payloads.
- `HkiRetriever` — wraps any LlamaIndex retriever and drops `NodeWithScore`
  entries that are not labelled for the active domain.
- `HkiQueryEngine` — duck-typed wrapper around any query engine that
  asserts the response source nodes are visible to the active domain.
- `hki_cache_key` — derives a domain-bound cache key.

Usage:

```python
from hki_llamaindex import HkiCallbackHandler, HkiRetriever
from llama_index.core import Settings

Settings.callback_manager.add_handler(HkiCallbackHandler(envelope=signed_envelope))
safe_retriever = HkiRetriever(my_retriever, envelope=signed_envelope)
```

See [docs/HKI_ROADMAP.md](../../docs/HKI_ROADMAP.md) (M14).
