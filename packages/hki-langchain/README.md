# hki-langchain

HKI runtime isolation for LangChain and LangGraph.

Wraps any LangChain chain, retriever, or cache with domain-scoped enforcement.
The chain itself is not modified — HKI enforces at the boundary via callbacks and wrappers.

[![PyPI](https://img.shields.io/pypi/v/hki-langchain)](https://pypi.org/project/hki-langchain/)
[![HKI Conformant](https://img.shields.io/badge/HKI-Conformant%20L3-green)](https://github.com/h3nok/HKI)

## Install

```bash
pip install hki-langchain
```

## Quickstart (60 seconds)

```python
from hki_langchain import HkiCallbackHandler, HkiRetriever

# 1. Wrap your retriever — drops documents from the wrong domain automatically
retriever = HkiRetriever(retriever=your_retriever)

# 2. Run your chain with the HKI callback
chain.invoke(
    {"question": "what is the return policy"},
    config={
        "callbacks": [HkiCallbackHandler()],
        "metadata": {"hki_envelope": signed_envelope_dict},
    },
)
```

That's it. The chain is unchanged. HKI enforces at the edge.

---

## What it does

### `HkiRetriever` — domain-filtered retrieval

Wraps any `BaseRetriever`. Before returning documents to the chain, it calls
`assert_artifact_visible` from `hki-runtime` and drops any document whose
`metadata["domain"]` does not match the active domain in the envelope.

```python
from hki_langchain import HkiRetriever
from langchain_community.retrievers import BM25Retriever

# Your existing retriever — unchanged
base = BM25Retriever.from_documents(your_docs)

# Wrap it — now domain-isolated
safe = HkiRetriever(retriever=base)

# Pass the envelope in config — documents from other domains are silently dropped
docs = safe.invoke(
    "refund policy",
    config={"metadata": {"hki_envelope": pharmacy_envelope}},
)
```

### `HkiCallbackHandler` — envelope enforcement on every chain event

Attaches to any LangChain chain. Validates the envelope on start, then checks
every LLM call, tool call, and retriever event against the active domain.
Raises `PermissionError` on any violation.

```python
from hki_langchain import HkiCallbackHandler

# Add to any chain run — no changes to the chain itself
result = rag_chain.invoke(
    "what is the cancellation policy",
    config={
        "callbacks": [HkiCallbackHandler()],
        "metadata": {"hki_envelope": travel_envelope},
    },
)
```

Blocked automatically:
- No envelope → `PermissionError: HKI envelope missing`
- Expired envelope → `PermissionError: envelope expired`
- `active_domain: "global"` → `PermissionError: global domain not allowed`
- Tool target in a different domain → `PermissionError: gateway target denied`
- Request body contains a conflicting `domain` key → `PermissionError: scope override rejected`

### `hki_cache_key` — domain-bound cache keys

Derives a cache key that includes `org_id` and `active_domain`. Prevents
cross-domain cache collisions when the same query is asked in two different domains.

```python
from hki_langchain import hki_cache_key

key = hki_cache_key(envelope, "what is the return policy")
# key is stable for same org + domain + query; different for different domains
```

Use with any LangChain `BaseCache`:

```python
from langchain.globals import set_llm_cache
from langchain.cache import InMemoryCache

cache = InMemoryCache()
set_llm_cache(cache)

# When storing results, use the HKI key instead of the raw query
cache.update(hki_cache_key(envelope, prompt), llm_string, response)
```

---

## Full example: multi-domain RAG

```python
from langchain_core.runnables import RunnableLambda, RunnablePassthrough
from langchain_core.prompts import ChatPromptTemplate
from hki_langchain import HkiCallbackHandler, HkiRetriever

PHARMACY_ENVELOPE = {
    "hki_version": "1.0",
    "envelope_id": "env_001",
    "org_id": "org_acme",
    "subject_id": "user_42",
    "active_domain": "pharmacy",
    "authorized_domains": ["pharmacy"],
    "purpose": "retrieve",
    "risk_tier": "read-only",
    "policy_pack_id": "pharmacy@2026-05",
    "issued_at": 0,
    "expires_at": 9_999_999_999,
    "issuer": "gateway.acme.internal",
    "signature": "ed25519:your-signature",
}

# Wrap retriever — drops travel/membership/other docs automatically
retriever = HkiRetriever(retriever=your_vector_store.as_retriever())

# Build chain — no HKI-specific changes to the chain itself
rag_chain = (
    {"context": retriever | RunnableLambda(lambda docs: "\n".join(d.page_content for d in docs)),
     "question": RunnablePassthrough()}
    | ChatPromptTemplate.from_template("Context: {context}\n\nQuestion: {question}")
    | your_llm
)

# Invoke with HKI — domain isolation is enforced end to end
answer = rag_chain.invoke(
    "what is the prescription pickup policy",
    config={
        "callbacks": [HkiCallbackHandler()],
        "metadata": {"hki_envelope": PHARMACY_ENVELOPE},
    },
)
```

---

## How the envelope is threaded

The envelope is passed via `config["metadata"]["hki_envelope"]`.
`HkiCallbackHandler` reads it from there and makes it available to every callback event.
`HkiRetriever` reads it from the same location in its own `invoke` config.

If you are building a custom component, you can also pass the envelope as a direct
parameter to `find_envelope` from `hki_langchain`:

```python
from hki_langchain import find_envelope

envelope = find_envelope(config=run_manager.get_child().metadata)
```

---

## LangGraph

The same integration works in LangGraph — pass the envelope in `config["metadata"]`
when invoking a graph:

```python
graph.invoke(
    {"messages": [HumanMessage(content="...")], "domain": "pharmacy"},
    config={
        "callbacks": [HkiCallbackHandler()],
        "metadata": {"hki_envelope": pharmacy_envelope},
    },
)
```

---

## Notebook

[Interactive demo with before/after isolation examples](../../notebooks/02_langchain_rag.ipynb) — runnable in Google Colab.

## Related packages

- [`hki-runtime`](../hki-runtime-py) — core envelope primitives (used by this package)
- [`hki-litellm`](../hki-litellm) — LiteLLM callback for model-level enforcement
- [`hki-llamaindex`](../hki-llamaindex) — LlamaIndex equivalent of this package
- [`@hki/conformance`](../hki-conformance) — conformance test suite

## Standard

[HKI 1.0 Spec](../../spec/HKI-1.0.md) · [Threat Catalog](../../docs/HKI_THREATS.md) · [GitHub](https://github.com/h3nok/HKI)
