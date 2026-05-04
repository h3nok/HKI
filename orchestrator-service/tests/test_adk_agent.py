from __future__ import annotations

import os
from unittest.mock import patch


def test_build_adk_agent_uses_vertex_env_without_llm_key(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_GENAI_USE_VERTEXAI", raising=False)
    monkeypatch.delenv("GOOGLE_CLOUD_PROJECT", raising=False)
    monkeypatch.delenv("GOOGLE_CLOUD_LOCATION", raising=False)

    with (
        patch("src.domain.adk_agent.Agent") as mock_agent,
        patch("src.domain.adk_agent.settings") as mock_settings,
    ):
        mock_settings.GCP_PROJECT_ID = "retail-prod"
        mock_settings.GCP_LOCATION = "us-central1"
        mock_settings.VERTEX_AI_LOCATION = "us-east5"
        mock_settings.AGENT_MODEL = "gemini-2.5-flash"

        from src.domain.adk_agent import build_adk_agent

        build_adk_agent(model_name="gemini-2.5-flash", tool_functions=[])

    assert os.environ["GOOGLE_GENAI_USE_VERTEXAI"] == "true"
    assert os.environ["GOOGLE_CLOUD_PROJECT"] == "retail-prod"
    assert os.environ["GOOGLE_CLOUD_LOCATION"] == "us-east5"
    assert mock_agent.call_args.kwargs["model"] == "gemini-2.5-flash"
    assert mock_agent.call_args.kwargs["tools"] == []