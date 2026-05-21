# HKI Adapters — Reference Index

For Google Cloud adopters, HKI is **ADK-first, not ADK-only**. The ADK adapter is
the recommended path for Gemini Enterprise Agent Platform managed runtimes, while
the other adapters keep HKI portable across common agent and retrieval stacks.
See [docs/HKI_ADK_FIRST_MANAGED_SERVICES_PLAN.md](HKI_ADK_FIRST_MANAGED_SERVICES_PLAN.md)
for the managed-services roadmap.

The HKI reference implementation ships **six** framework adapters. Every
adapter is duck-typed (no hard dep on its framework — frameworks are
optional extras), MIT-licensed, and shares the same denial-code shape:
`code` + `message`.

| Package                                      | Framework             | Surface                                                                              | Tests | Status |
| -------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------ | ----- | ------ |
| [hki-adk](../packages/hki-adk)               | Google ADK            | `HkiToolGuard`, `HkiBeforeAgentCallback`, `HkiBeforeToolCallback`, `HkiSessionGuard` | 11    | M15    |
| [hki-litellm](../packages/hki-litellm)       | LiteLLM gateway       | `pre_call`, `post_call`, `HkiLiteLLMCallback`                                        | 7     | M10    |
| [hki-langchain](../packages/hki-langchain)   | LangChain / LangGraph | `HkiCallbackHandler`, `HkiRetriever`, `hki_cache_key`                                | 9     | M11    |
| [hki-llamaindex](../packages/hki-llamaindex) | LlamaIndex            | `HkiCallbackHandler`, `HkiRetriever`, `HkiQueryEngine`, `hki_cache_key`              | 11    | M14    |
| [hki-autogen](../packages/hki-autogen)       | Microsoft AutoGen     | `HkiMessageGuard`, `HkiToolWrapper`, `HkiAgentMixin`, `hki_cache_key`                | 12    | M16    |
| [hki-crewai](../packages/hki-crewai)         | CrewAI                | `HkiTaskGuard`, `HkiToolWrapper`, `HkiCrewGuard`, `hki_cache_key`                    | 12    | M17    |

Plus the cross-adapter integration suite:

| Package                                                    | Purpose                                                                                                                                                                                                                                                 | Tests |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| [hki-integration-tests](../packages/hki-integration-tests) | Imports all six adapters in one process; asserts envelope round-trip, scope-override rejection, gateway-target, cache-key isolation, cross-domain artifact rejection, and session/stream consistency are all enforced identically across every adapter. | 8     |

## Five invariants every adapter enforces

1. **Envelope required.** Operating without a signed HKI envelope is a
   `missing-envelope` denial.
2. **Envelope must validate.** A widened or expired envelope is an
   `envelope-invalid` denial.
3. **No body-scope-trust.** A request whose body / payload / kwargs
   carries a `scope`, `streamId`, `active_domain`, etc. that conflicts
   with the signed envelope is a `scope-override` denial.
4. **Tool / model gateway-target check.** A tool or model that lives in
   a domain not in `authorized_domains` (and not published into the
   active domain) is a `gateway-denied` denial.
5. **Artifact-visibility check.** A document / node returned by a
   retriever whose label points to a different domain is an
   `artifact-scope-mismatch` denial.

Plus three integrity invariants where applicable:

6. **Session consistency** (ADK) — events in one session must share an
   `envelope_id`. Mismatch raises `session-envelope-mismatch`.
7. **Stream consistency** (AutoGen) — messages in a stream must share an
   `envelope_id`. Mismatch raises `stream-envelope-mismatch`.
8. **Crew consistency** (CrewAI) — tasks in a crew must share an
   `envelope_id`. Mismatch raises `crew-envelope-mismatch`.

## Quick start

```bash
# Install + test every adapter
pnpm test:hki-adapters

# Run the cross-adapter integration suite
pnpm test:hki-integration

# Run the full end-to-end demo
uv run --project packages/hki-integration-tests \
    python examples/end_to_end_demo.py
```

## Per-adapter usage examples

### LangChain

```python
from hki_langchain import HkiCallbackHandler, HkiRetriever

chain.invoke(
    {"question": "..."},
    config={
        "callbacks": [HkiCallbackHandler()],
        "metadata": {"hki_envelope": signed_envelope_dict},
    },
)
safe_retriever = HkiRetriever(my_retriever)
```

### LlamaIndex

```python
from hki_llamaindex import HkiCallbackHandler, HkiRetriever, HkiQueryEngine
from llama_index.core import Settings

Settings.callback_manager.add_handler(
    HkiCallbackHandler(envelope=signed_envelope_dict)
)
safe_retriever = HkiRetriever(my_retriever, envelope=signed_envelope_dict)
safe_qe = HkiQueryEngine(my_query_engine, envelope=signed_envelope_dict)
```

### Google ADK

```python
from hki_adk import HkiToolGuard, HkiBeforeAgentCallback
from google.adk.agents import LlmAgent

agent = LlmAgent(
    model="gemini-2.0-flash",
    tools=[HkiToolGuard(my_tool, domain="iris")],
    before_agent_callback=HkiBeforeAgentCallback(),
)
```

### AutoGen

```python
from hki_autogen import HkiMessageGuard, HkiToolWrapper

guard = HkiMessageGuard()
guard.assert_message_authorized(message)

safe_tool = HkiToolWrapper(my_tool, envelope=signed_envelope_dict, domain="iris")
```

### CrewAI

```python
from hki_crewai import HkiTaskGuard, HkiToolWrapper, HkiCrewGuard

HkiTaskGuard().assert_task_authorized(task)
HkiCrewGuard().assert_crew_authorized(crew)

safe_tool = HkiToolWrapper(my_tool, envelope=signed_envelope_dict)
```

### LiteLLM

```python
from hki_litellm import HkiLiteLLMCallback

import litellm
litellm.callbacks = [HkiLiteLLMCallback()]

# Every litellm.completion(...) call must include
#   metadata={"hki_envelope": signed_envelope_dict}
```

## Where each adapter sits in the agent stack

```
                    ┌──────────────────────────────────────┐
                    │  Agent runtime (LangGraph / ADK /    │
                    │  AutoGen / CrewAI)                   │
                    └──────────┬─────────────┬─────────────┘
                               │             │
                  ┌────────────┴───┐    ┌────┴───────────┐
                  │ Retriever      │    │ Tool / model   │
                  │ (LangChain /   │    │ gateway        │
                  │  LlamaIndex)   │    │ (LiteLLM)      │
                  └────────────────┘    └────────────────┘
                          │                    │
                          └────────┬───────────┘
                                   │
                          ┌────────▼──────────┐
                          │ hki-runtime       │
                          │ (envelope, policy)│
                          └───────────────────┘
```

## Roadmap milestones

- M10 — `hki-litellm`
- M11 — `hki-langchain`
- M14 — `hki-llamaindex`
- M15 — `hki-adk`
- M16 — `hki-autogen`
- M17 — `hki-crewai`
- _cross-adapter_ — `hki-integration-tests`
