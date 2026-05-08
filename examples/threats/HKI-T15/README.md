# HKI-T15 — Prompt-injected scope override echoed by tool

A tool exposes a `domain` argument to the LLM. The LLM, manipulated by a
prompt-injected document, calls the tool with `domain="pulse"` while the
caller is signed for `iris`. Tool obeys the LLM, not the envelope.
