from __future__ import annotations

from typing import Any, Generator, NoReturn
from typing import Any, Generator
from typing import Any, Generator, NoReturn
import unittest.mock

import pytest

import src.domain.agent

KB_RESPONSE = {
    "query": "What does fall-protection-plan.md say about rescue response time?",
    "results": [
        {
            "id": "chunk-1",
            "document_id": "doc-1",
            "title": "fall-protection-plan.md",
            "content": (
                "## Rescue Plan\n"
                "- Maximum 6 minutes from fall arrest to rescue initiation\n"
                "- Suspension trauma risk: worker must be rescued within 15 minutes maximum"
            ),
            "score": 1.0,
        }
    ],
    "citations": [
        {
            "document_id": "doc-1",
            "title": "fall-protection-plan.md",
            "preview": "Maximum 6 minutes from fall arrest to rescue initiation.",
            "highlight": "worker must be rescued within 15 minutes maximum",
            "score": 1.0,
        }
    ],
    "total_results": 1,
    "search_time_ms": 8.2,
}


class _FakeFunctionResponse:
    def __init__(self, name: str, response: dict[str, object]) -> None:
        self.name: str = name
        self.response: dict[str, object] = response


class _FakePart:
    def __init__(self, *, function_response=None, text: str | None = None) -> None:
        self.function_call = None
        self.function_response = function_response
        self.text: str | None = text


class _FakeContent:
    def __init__(self, parts: list[_FakePart]) -> None:
        self.parts: list[_FakePart] = parts


class _FakeEvent:
    def __init__(self, parts: list[_FakePart], *, final: bool = False) -> None:
        self.content = _FakeContent(parts)
        self._final: bool = final

    def is_final_response(self) -> bool:
        return self._final


def _kb_event() -> _FakeEvent:
    return _FakeEvent(
        [_FakePart(function_response=_FakeFunctionResponse("search_knowledge", KB_RESPONSE))]
    )


class _FailingRunner:
    def __init__(self, *args, **kwargs) -> None:
        pass

    async def run_async(self, **kwargs) -> Generator[_FakeEvent, Any, NoReturn]:
        yield _kb_event()
        raise RuntimeError("model synthesis failed")


class _NoFinalRunner:
    def __init__(self, *args, **kwargs) -> None:
        pass

    async def run_async(self, **kwargs) -> Generator[_FakeEvent, Any, None]:
        yield _kb_event()


class _PartialThenFailRunner:
    def __init__(self, *args, **kwargs) -> None:
        pass

    async def run_async(self, **kwargs) -> Generator[_FakeEvent, Any, NoReturn]:
        yield _FakeEvent([_FakePart(text="Partial answer.")], final=True)
        raise RuntimeError("post-response failure")


async def _collect(agent: src.domain.agent.AdkAgent, message: str) -> list[dict[str, object]]:
    return [
        event
        async for event in agent.chat_stream(
            session_id="conv-1",
            message=message,
        )
    ]


@pytest.mark.asyncio
async def test_runtime_error_after_kb_retrieval_uses_grounded_fallback() -> None:
    agent = src.domain.agent.AdkAgent()

    with (
        unittest.mock.patch("src.domain.adk_agent.build_adk_agent", return_value=object()),
        unittest.mock.patch("src.domain.agent.google.adk.runners.Runner", _FailingRunner),
    ):
        events: list[dict[str, object]] = await _collect(
            agent,
            "What does fall-protection-plan.md say about rescue response time?",
        )

    final_text: str = "".join(
        str(event["content"])
        for event: dict[str, object] in events
        if isinstance(event, dict) and event.get("type") == "final_response_chunk"
    )
    metadata: object = next(
        event["metadata"]
        for event: dict[str, object] in events
        if isinstance(event, dict) and event.get("type") == "response_metadata"
    )

    assert "6 minutes" in final_text
    assert "15 minutes" in final_text
    assert final_text.lower().count("6 minutes") == 1
    assert "internal error" not in final_text.lower()
    assert metadata["fallback_used"] is True
    assert metadata["fallback_reason"] == "runtime_error_after_retrieval"


@pytest.mark.asyncio
async def test_missing_final_response_uses_grounded_fallback() -> None:
    agent = src.domain.agent.AdkAgent()

    with (
        unittest.mock.patch("src.domain.adk_agent.build_adk_agent", return_value=object()),
        unittest.mock.patch("src.domain.agent.google.adk.runners.Runner", _NoFinalRunner),
    ):
        events: list[dict[str, object]] = await _collect(
            agent,
            "Summarize the key points in fall-protection-plan.md",
        )

    final_text: str = "".join(
        str(event["content"])
        for event: dict[str, object] in events
        if isinstance(event, dict) and event.get("type") == "final_response_chunk"
    )
    metadata: object = next(
        event["metadata"]
        for event: dict[str, object] in events
        if isinstance(event, dict) and event.get("type") == "response_metadata"
    )

    assert "Based on the retrieved passages from fall-protection-plan.md" in final_text
    assert "6 minutes" in final_text
    assert metadata["fallback_used"] is True
    assert metadata["fallback_reason"] == "missing_final_response_after_retrieval"


@pytest.mark.asyncio
async def test_partial_response_does_not_append_internal_error() -> None:
    agent = src.domain.agent.AdkAgent()

    with (
        unittest.mock.patch("src.domain.adk_agent.build_adk_agent", return_value=object()),
        unittest.mock.patch("src.domain.agent.google.adk.runners.Runner", _PartialThenFailRunner),
    ):
        events: list[dict[str, object]] = await _collect(agent, "Summarize the key points in fall-protection-plan.md")

    final_text: str = "".join(
        str(event["content"])
        for event: dict[str, object] in events
        if isinstance(event, dict) and event.get("type") == "final_response_chunk"
    )

    assert final_text == "Partial answer."
    assert "internal error" not in final_text.lower()
