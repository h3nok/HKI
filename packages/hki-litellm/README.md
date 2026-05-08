# hki-litellm

HKI integration for [LiteLLM](https://github.com/BerriAI/litellm).

Forces every LiteLLM call to carry a valid signed HKI envelope, derives a
domain-bound cache key, evaluates the model as a gateway target, and stamps
envelope attributes on the trace.

```python
import litellm
from hki_litellm import HkiLiteLLMCallback

litellm.callbacks = [HkiLiteLLMCallback()]

litellm.completion(
    model="vertex_ai/gemini-2.5-flash",
    messages=[{"role": "user", "content": "hello"}],
    metadata={"hki_envelope": signed_envelope_dict},
)
```

Calls without `metadata.hki_envelope`, with `active_domain` set to `global`
or `*`, with an expired envelope, or targeting a model that is not bound to
the active domain are aborted before the upstream provider is called.

See [docs/HKI_ROADMAP.md#track-3](../../docs/HKI_ROADMAP.md) (M10).
