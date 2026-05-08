# hki-langchain

HKI integration for LangChain and LangGraph.

Provides three things:

- `HkiCallbackHandler` — enforces a signed HKI envelope on every chain,
  LLM, chat-model, tool, and retriever event; rejects scope overrides and
  unbound tool targets.
- `HkiRetriever` — wraps any LangChain retriever and drops documents that
  are not labelled for the active domain.
- `hki_cache_key` — derives a domain-bound cache key for any LangChain
  `BaseCache`.

Usage:

```python
from hki_langchain import HkiCallbackHandler

chain.invoke(
    {"question": "..."},
    config={
        "callbacks": [HkiCallbackHandler()],
        "metadata": {"hki_envelope": signed_envelope_dict},
    },
)
```

See [docs/HKI_ROADMAP.md](../../docs/HKI_ROADMAP.md) (M11).
