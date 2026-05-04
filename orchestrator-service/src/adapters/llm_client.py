"""
LLM Adapter — OpenAI-compatible client pointing at whatever AI gateway is
configured via LLM_GATEWAY_URL (LiteLLM locally, Apigee X or any
OpenAI-compatible proxy in production).

When LLM_GATEWAY_URL is empty, the client switches to *direct Vertex AI mode*:
it calls litellm.acompletion() as a Python library using Application Default
Credentials (ADC) — no HTTP gateway needed.  This is the correct path when
running inside Vertex AI Agent Engine, where the service account already has
Vertex AI access and there is no gateway to route through.

  LLM_GATEWAY_URL set   → HTTP POST to gateway (Apigee / LiteLLM proxy)
  LLM_GATEWAY_URL empty → litellm.acompletion() via ADC (Agent Engine / local)

This is a thin wrapper over httpx that:
1. Normalizes messages into OpenAI chat completion format
2. Sends tool definitions in function-calling format
3. Parses tool_calls from the response
4. Handles errors and timeouts gracefully
"""

from __future__ import annotations

import asyncio
import collections.abc
import json
import random
import typing
import urllib.parse

import httpx
import litellm
import shared.http_client

import src.core.config
import src.core.logging
import src.domain.models

# Status codes that are safe to retry (transient errors)
_RETRYABLE_STATUS_CODES: set[int] = {429, 502, 503, 504}

create_service_client: collections.abc.Callable[..., httpx.AsyncClient] = (
    shared.http_client.create_service_client
)
settings = src.core.config.settings


def _is_expected_hostname(url: str, expected_hostname: str) -> bool:
    try:
        hostname = urllib.parse.urlparse(url).hostname
    except ValueError:
        return False
    return (hostname or "").lower() == expected_hostname


def _is_iap_redirect(resp: httpx.Response) -> bool:
    location = resp.headers.get("location", "").lower()
    iap_header = resp.headers.get("x-goog-iap-generated-response", "").lower()
    return resp.status_code in {302, 303, 307, 308} and (
        _is_expected_hostname(location, "accounts.google.com") or iap_header == "true"
    )


def _is_iap_auth_failure(resp: httpx.Response, body: str) -> bool:
    if _is_iap_redirect(resp):
        return True
    if resp.status_code not in {401, 403}:
        return False
    body_lower: str = body.lower()
    return (
        "iap" in body_lower
        or "unable to parse jwt" in body_lower
        or "identity token" in body_lower
    )


def _normalize_vertex_model(model: str) -> str:
    normalized: str = model.removeprefix("vertex_ai/").strip()
    alias_map = {
        # The BFF uses Gemini 3 aliases through the gateway, but direct Vertex
        # fallback in this project/location needs stable publisher model IDs.
        "gemini-3-pro": settings.LLM_MODEL_SMART,
        "gemini-3-flash": settings.LLM_MODEL_FAST,
    }
    resolved = alias_map.get(normalized, normalized)
    return resolved if resolved.startswith("vertex_ai/") else f"vertex_ai/{resolved}"


class LLMClient:
    """Async OpenAI-compatible LLM client."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
    ) -> None:
        resolved_base_url = (
            settings.LLM_GATEWAY_URL if base_url is None else base_url
        )
        self._base_url = resolved_base_url.rstrip("/")
        self._api_key = api_key or settings.LLM_API_KEY
        self._default_model = model or settings.LLM_MODEL_DEFAULT
        self._timeout = timeout or settings.LLM_REQUEST_TIMEOUT
        # No gateway URL → call Vertex AI directly via litellm + ADC.
        # Skip the httpx pool entirely — 200 idle connections would be wasted.
        self._vertex_direct: bool = not self._base_url
        self._client: None | httpx.AsyncClient = (
            None
            if self._vertex_direct
            else create_service_client(
                "orchestrator-llm",
                timeout=self._timeout,
                max_connections=200,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self._api_key}",
                },
            )
        )
        # Circuit breaker for the gateway. When it trips, we fall back to
        # direct Vertex AI calls via litellm (same as vertex_direct mode).
        self._gateway_breaker = shared.http_client.CircuitBreaker(
            failure_threshold=5, recovery_timeout=30.0
        )

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()

    async def chat(
        self,
        messages: list[src.domain.models.ChatMessage | dict[str, typing.Any]],
        *,
        tools: list[dict[str, typing.Any]] | None = None,
        tool_choice: str | None = "auto",
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        enable_thinking: bool = False,
        thinking_budget: int = 2048,
        response_format: dict[str, typing.Any] | None = None,
    ) -> LLMResponse:
        """
        Send a chat completion request.

        Returns an LLMResponse with the assistant content and any tool calls.
        """
        model = model or self._default_model
        temperature = (
            temperature if temperature is not None else settings.LLM_TEMPERATURE
        )
        max_tokens = max_tokens or settings.LLM_MAX_TOKENS

        # Normalize messages
        normalized: list[dict[str, typing.Any]] = []
        for msg in messages:
            if isinstance(msg, src.domain.models.ChatMessage):
                d: dict[str, typing.Any] = {"role": msg.role.value, "content": msg.content}
                if msg.name:
                    d["name"] = msg.name
                if msg.tool_call_id:
                    d["tool_call_id"] = msg.tool_call_id
                normalized.append(d)
            else:
                normalized.append(msg)

        payload: dict[str, typing.Any] = {
            "model": model,
            "messages": normalized,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if tools:
            payload["tools"] = tools
            if tool_choice:
                payload["tool_choice"] = tool_choice

        # Structured output — JSON schema mode for deterministic parsing
        if response_format:
            payload["response_format"] = response_format

        # Gemini 2.5 native thinking — request reasoning_content in response
        if enable_thinking:
            payload["thinking"] = {"type": "enabled", "budget_tokens": thinking_budget}

        src.core.logging.logger.info(
            "LLM request",
            extra={
                "model": model,
                "messages": len(normalized),
                "tools": len(tools or []),
                "mode": "vertex_direct" if self._vertex_direct else "gateway",
            },
        )

        # ── Short-circuit: vertex-direct mode uses litellm as a library ──
        if self._vertex_direct:
            return await self._chat_via_litellm(
                messages=normalized,
                tools=tools,
                tool_choice=tool_choice,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
            )

        # ── Circuit breaker: fall back to Vertex AI when gateway is down ──
        if not self._gateway_breaker.allow_request:
            src.core.logging.logger.warning(
                "Gateway circuit breaker OPEN — falling back to Vertex AI direct",
                extra={"model": model, "breaker_state": self._gateway_breaker.state.value},
            )
            return await self._chat_via_litellm(
                messages=normalized,
                tools=tools,
                tool_choice=tool_choice,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
            )

        url: str = f"{self._base_url}/chat/completions"

        # Retry with exponential backoff for transient errors (429/502/503/504)
        max_retries = 3
        last_exc: Exception | None = None

        assert self._client is not None  # only reachable when not vertex_direct
        for attempt in range(max_retries + 1):
            try:
                resp: httpx.Response = await self._client.post(url, json=payload)
                if not resp.is_success:
                    status: int = resp.status_code
                    body: str = resp.text[:500]

                    if status in _RETRYABLE_STATUS_CODES and attempt < max_retries:
                        self._gateway_breaker.record_failure()
                        # Respect Retry-After header if present
                        retry_after = resp.headers.get("retry-after")
                        if retry_after and retry_after.isdigit():
                            delay: float = min(float(retry_after), 30.0)
                        else:
                            delay = (2**attempt) + random.uniform(0, 1)
                        src.core.logging.logger.warning(
                            "LLM retryable error",
                            extra={
                                "status": status,
                                "attempt": attempt + 1,
                                "max_retries": max_retries,
                                "retry_delay_s": round(delay, 2),
                            },
                        )
                        last_exc = LLMError(f"LLM returned {status}: {body}")
                        await asyncio.sleep(delay)
                        continue

                    self._gateway_breaker.record_failure()
                    src.core.logging.logger.error(
                        "LLM error",
                        extra={"status": status, "body": body},
                    )
                    if _is_iap_auth_failure(resp, body):
                        raise LLMError(
                            "LLM gateway authentication failed (IAP/identity token)"
                        )
                    raise LLMError(f"LLM returned {status}: {body}")
                self._gateway_breaker.record_success()
                break  # success
            except httpx.TimeoutException as exc:
                self._gateway_breaker.record_failure()
                if attempt < max_retries:
                    delay = (2**attempt) + random.uniform(0, 1)
                    src.core.logging.logger.warning(
                        "LLM timeout, retrying",
                        extra={
                            "attempt": attempt + 1,
                            "timeout": self._timeout,
                            "retry_delay_s": round(delay, 2),
                        },
                    )
                    last_exc = exc
                    await asyncio.sleep(delay)
                    continue
                src.core.logging.logger.error(
                    "LLM timeout (exhausted retries)",
                    extra={"timeout": self._timeout},
                )
                raise LLMError("LLM request timed out") from exc
            except httpx.RequestError as exc:
                self._gateway_breaker.record_failure()
                if attempt < max_retries:
                    delay = (2**attempt) + random.uniform(0, 1)
                    src.core.logging.logger.warning(
                        "LLM transport error, retrying",
                        extra={
                            "attempt": attempt + 1,
                            "max_retries": max_retries,
                            "retry_delay_s": round(delay, 2),
                            "error": str(exc),
                        },
                    )
                    last_exc = exc
                    await asyncio.sleep(delay)
                    continue
                src.core.logging.logger.error(
                    "LLM transport error (exhausted retries)",
                    extra={"error": str(exc)},
                )
                raise LLMError(f"LLM gateway request failed: {exc}") from exc
        else:
            # All retries exhausted
            raise LLMError(f"LLM request failed after {max_retries} retries") from last_exc

        data = resp.json()
        choice = data["choices"][0]
        message = choice["message"]

        # Parse tool calls
        tool_calls: list[src.domain.models.ToolCallRequest] = []
        raw_tool_calls = message.get("tool_calls") or []
        for tc in raw_tool_calls:
            try:
                arguments = json.loads(tc["function"]["arguments"])
            except (json.JSONDecodeError, KeyError):
                arguments = {}
            tool_calls.append(
                src.domain.models.ToolCallRequest(
                    id=tc["id"],
                    name=tc["function"]["name"],
                    arguments=arguments,
                )
            )

        # Gemini 2.5 thinking models return reasoning in 'reasoning_content'.
        # Older thinking models used 'thinking'. Check both.
        thinking: typing.Any | str = (
            message.get("reasoning_content") or message.get("thinking") or ""
        )

        llm_response = LLMResponse(
            content=message.get("content") or "",
            thinking=thinking,
            tool_calls=tool_calls,
            raw_tool_calls=raw_tool_calls,
            finish_reason=choice.get("finish_reason"),
            model=data.get("model", model),
            usage=data.get("usage"),
        )

        return llm_response

    # ── Vertex AI direct mode (no HTTP gateway) ───────────────────────────

    async def _chat_via_litellm(
        self,
        messages: list[dict[str, typing.Any]],
        *,
        tools: list[dict[str, typing.Any]] | None,
        tool_choice: str | None,
        model: str,
        temperature: float,
        max_tokens: int,
    ) -> LLMResponse:
        """
        Call Vertex AI Gemini directly via litellm.acompletion() — no HTTP
        gateway.  Uses Application Default Credentials automatically.

        Activated when LLM_GATEWAY_URL is empty (e.g. inside Agent Engine).
        The model name is prefixed with 'vertex_ai/' if not already set.
        """
        try:
            import litellm  # type: ignore[import-untyped]
        except ImportError as exc:
            raise LLMError(
                "litellm is required for direct Vertex AI calls via LLMClient. "
                "Install the orchestrator-service dependencies."
            ) from exc

        vertex_model: str = _normalize_vertex_model(model)

        kwargs: dict[str, typing.Any] = {
            "model": vertex_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "vertex_project": settings.GCP_PROJECT_ID,
            "vertex_location": (
                settings.VERTEX_AI_LOCATION or settings.GCP_LOCATION
            ),
        }
        if tools:
            kwargs["tools"] = tools
            if tool_choice:
                kwargs["tool_choice"] = tool_choice

        try:
            resp: litellm.ModelResponse | litellm.CustomStreamWrapper = (
                await litellm.acompletion(**kwargs)
            )
        except Exception as exc:
            raise LLMError(f"Vertex AI direct call failed: {exc}") from exc

        choice = resp.choices[0]
        msg = choice.message

        tool_calls: list[src.domain.models.ToolCallRequest] = []
        raw_tool_calls: list[dict[str, typing.Any]] = []
        for tc in msg.tool_calls or []:
            raw_tool_calls.append(
                {
                    "id": tc.id,
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
            )
            try:
                arguments = json.loads(tc.function.arguments)
            except (json.JSONDecodeError, AttributeError):
                arguments = {}
            tool_calls.append(
                src.domain.models.ToolCallRequest(
                    id=tc.id,
                    name=tc.function.name,
                    arguments=arguments,
                )
            )

        usage: dict[str, int] | None = None
        if resp.usage:
            usage = {
                "prompt_tokens": resp.usage.prompt_tokens or 0,
                "completion_tokens": resp.usage.completion_tokens or 0,
                "total_tokens": resp.usage.total_tokens or 0,
            }

        return LLMResponse(
            content=msg.content or "",
            thinking="",
            tool_calls=tool_calls,
            raw_tool_calls=raw_tool_calls,
            finish_reason=choice.finish_reason,
            model=resp.model or vertex_model,
            usage=usage,
        )


class LLMResponse:
    """Parsed response from the LLM."""

    def __init__(
        self,
        content: str,
        tool_calls: list[src.domain.models.ToolCallRequest],
        raw_tool_calls: list[dict[str, typing.Any]],
        finish_reason: str | None,
        model: str,
        usage: dict[str, int] | None,
        thinking: str = "",
    ) -> None:
        self.content: str = content
        self.thinking: str = thinking
        self.tool_calls = tool_calls
        self.raw_tool_calls: list[dict[str, typing.Any]] = raw_tool_calls
        self.finish_reason: str | None = finish_reason
        self.model: str = model
        self.usage: dict[str, int] | None = usage

    @property
    def has_tool_calls(self) -> bool:
        return len(self.tool_calls) > 0


class LLMError(Exception):
    """Raised when the LLM gateway returns an error or times out."""
