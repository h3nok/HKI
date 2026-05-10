"""
Tests for the policy-driven orchestration helpers.

These focus on execution-policy merging, model routing, and tool approval
gates that sit above the ADK runner.
"""

from __future__ import annotations

import typing
import unittest.mock

import pytest

import src.core.config
import src.domain.agent
import src.domain.memory
import src.domain.models


class TestExecutionPolicy:
    def test_stream_policy_merges_legacy_and_nested_controls(self) -> None:
        agent = src.domain.agent.AdkAgent()
        stream_config = src.domain.models.StreamConfig(
            retrieval_strategy="graph",
            guardrail_config={"pii_detection": True},
            memory_config={"enabled": False, "max_episodes": 1},
            execution_policy=src.domain.models.ExecutionPolicy(
                model_tier=src.domain.models.ModelTier.THINKING,
                enable_planning=False,
                tool_permissions=src.domain.models.ToolPermissionPolicy(
                    approval_mode=src.domain.models.ApprovalMode.ALWAYS,
                    deny_tools=["search_products"],
                ),
                memory=src.domain.models.MemoryPolicy(max_semantic_facts=2),
            ),
        )

        policy = agent._build_execution_policy(stream_config)

        assert policy.retrieval_strategy == "graph"
        assert policy.model_tier == src.domain.models.ModelTier.THINKING
        assert policy.enable_planning is False
        assert policy.guardrail_config["pii_detection"] is True
        assert policy.tool_permissions.approval_mode == src.domain.models.ApprovalMode.ALWAYS
        assert policy.tool_permissions.deny_tools == ["search_products"]
        assert policy.memory.enabled is False
        assert policy.memory.max_episodes == 1
        assert policy.memory.max_semantic_facts == 2

    def test_complex_requests_escalate_model_tier(self) -> None:
        agent = src.domain.agent.AdkAgent()
        policy = src.domain.models.ExecutionPolicy()

        model_name, model_tier, reason = agent._select_model(
            "Create a governance strategy and compare the tradeoffs across model tiers.",
            policy,
        )

        assert model_tier == src.domain.models.ModelTier.SMART
        assert model_name == src.core.config.settings.AGENT_MODEL_SMART
        assert "escalated" in reason

    def test_fast_model_retry_candidates_prefer_verified_default(self) -> None:
        agent = src.domain.agent.AdkAgent()

        candidates: list[str] = agent._build_model_retry_candidates(
            "gemini-2.0-flash",
            src.domain.models.ModelTier.FAST,
        )

        assert candidates[0] == "gemini-2.0-flash"
        assert candidates[1] == src.core.config.settings.AGENT_MODEL
        assert len(candidates) == len(set(candidates))

    def test_model_access_errors_are_detected(self) -> None:
        agent = src.domain.agent.AdkAgent()

        model_error = RuntimeError(
            "404 NOT_FOUND: Publisher Model `projects/demo/locations/us-central1/publishers/google/models/gemini-2.0-flash` was not found or your project does not have access to it"
        )
        unrelated_error = RuntimeError("knowledge api timeout")

        assert agent._is_model_access_error(model_error) is True
        assert agent._is_model_access_error(unrelated_error) is False

    def test_system_prompt_uses_layered_architecture(self) -> None:
        agent = src.domain.agent.AdkAgent()
        policy = src.domain.models.ExecutionPolicy()

        prompt, prompt_stack = agent._compose_system_prompt(
            (
                "You are the Pharmacy operations assistant. Focus on "
                "controlled workflows and SOP adherence."
            ),
            None,
            policy=policy,
            enabled_tools=["search_knowledge", "check_inventory"],
            scope="pharmacy",
            scopes=["pharmacy"],
        )

        assert "## Platform Constitution" in prompt
        assert "## Domain Persona" in prompt
        assert "## Tools" in prompt
        assert "## Runtime Policy" in prompt
        assert "You are the Pharmacy operations assistant." in prompt
        assert "Active scope: pharmacy" in prompt
        assert (
            "Do not ask the user to restate the current value stream or business domain." in prompt
        )
        assert (
            "If you need narrower context, ask only for the team, role, workflow, or decision area within this scope."
            in prompt
        )
        assert "search_knowledge" in prompt
        assert "check_inventory" in prompt
        assert "Do not use search_knowledge for greetings" in prompt
        assert "name the single best matching KB article explicitly" in prompt
        assert "Preserve exact rejection codes, error codes, field names, BIN/PCN values" in prompt
        assert "search those exact identifiers first" in prompt
        assert prompt_stack["summary"]["domain_prompt_source"] == "stream_override"
        assert prompt_stack["summary"]["enabled_tool_count"] == 2

    def test_conversational_plan_skips_default_knowledge_step(self) -> None:
        agent = src.domain.agent.AdkAgent()

        plan: src.domain.agent.ExecutionPlanState = agent._build_execution_plan(
            "Hello",
            ["search_knowledge", "search_products"],
        )

        assert [step.tool_name for step in plan.steps] == ["compose_response"]

    def test_information_request_still_defaults_to_knowledge_step(self) -> None:
        agent = src.domain.agent.AdkAgent()

        plan: src.domain.agent.ExecutionPlanState = agent._build_execution_plan(
            "Need the return procedure",
            ["search_knowledge"],
        )

        assert [step.tool_name for step in plan.steps] == [
            "search_knowledge",
            "compose_response",
        ]

    def test_system_prompt_appends_memory_as_separate_section(self) -> None:
        agent = src.domain.agent.AdkAgent()
        policy = src.domain.models.ExecutionPolicy()
        context = src.domain.memory.MemoryContext(
            semantic_facts=[{"key": "preferred_region", "value": "Midwest"}],
            total_memories=1,
        )

        prompt, prompt_stack = agent._compose_system_prompt(
            None,
            context,
            policy=policy,
            enabled_tools=["search_knowledge"],
            scope="global",
            scopes=["global"],
        )

        assert "## Working Memory" in prompt
        assert "=== MEMORY CONTEXT ===" in prompt
        assert "preferred_region: Midwest" in prompt
        assert prompt_stack["summary"]["working_memory_included"] is True
        assert prompt_stack["summary"]["working_memory_count"] == 1

    def test_execution_policy_summary_exposes_runtime_controls(self) -> None:
        agent = src.domain.agent.AdkAgent()
        policy = src.domain.models.ExecutionPolicy(
            model_tier=src.domain.models.ModelTier.THINKING,
            enable_planning=False,
            budgets={"max_turns": 4, "max_tool_calls": 2},
            tool_permissions=src.domain.models.ToolPermissionPolicy(
                approval_mode=src.domain.models.ApprovalMode.ALWAYS,
                sensitive_tools=["get_member_info"],
                require_approval_tools=["run_report"],
                approved_tools=["get_member_info"],
                deny_tools=["search_products"],
            ),
            memory=src.domain.models.MemoryPolicy(store_episodes=False, max_semantic_facts=2),
        )

        summary: dict[str, typing.Any] = agent._execution_policy_summary(policy)

        assert summary["model_tier"] == "thinking"
        assert summary["enable_planning"] is False
        assert summary["budgets"]["max_turns"] == 4
        assert summary["tool_permissions"]["approval_mode"] == "always"
        assert summary["tool_permissions"]["approved_tools"] == ["get_member_info"]
        assert summary["tool_permissions"]["deny_tools"] == ["search_products"]
        assert summary["memory"]["store_episodes"] is False


class TestToolApproval:
    @pytest.mark.asyncio
    async def test_high_risk_tool_requires_approval_by_default(self) -> None:
        agent = src.domain.agent.AdkAgent()
        context = src.domain.agent.ToolRunContext(
            user_id="user-1",
            org_id="default",
            conversation_id="conv-1",
            scope="global",
            scopes=["global"],
            policy=src.domain.models.ExecutionPolicy(),
            enabled_tools=["get_member_info"],
        )

        wrappers: dict[str, typing.Any] = agent._build_tool_wrappers(context)
        result = await wrappers["get_member_info"](member_number="12345")

        assert result["approval_required"] is True
        assert "Human approval required" in result["error"]
        assert result["_tool_meta"]["approval_required"] is True

    @pytest.mark.asyncio
    async def test_approved_tool_grant_bypasses_single_approval_gate(self) -> None:
        agent = src.domain.agent.AdkAgent()
        context = src.domain.agent.ToolRunContext(
            user_id="user-1",
            org_id="default",
            conversation_id="conv-1",
            scope="global",
            scopes=["global"],
            policy=src.domain.models.ExecutionPolicy(
                tool_permissions=src.domain.models.ToolPermissionPolicy(
                    approved_tools=["get_member_info"],
                )
            ),
            enabled_tools=["get_member_info"],
        )

        wrappers: dict[str, typing.Any] = agent._build_tool_wrappers(context)

        with unittest.mock.patch(
            "src.domain.adk_callbacks.execute_tool_with_hooks",
            new=unittest.mock.AsyncMock(
                return_value=({"member_number": "12345"}, 12.0, False)
            ),
        ) as execute_tool:
            result = await wrappers["get_member_info"](member_number="12345")

        execute_tool.assert_awaited_once()
        assert result["member_number"] == "12345"
        assert result["_tool_meta"].get("approval_required") is not True


class TestConversationalFastPath:
    @pytest.mark.asyncio
    async def test_greeting_bypasses_memory_and_model_execution(self) -> None:
        memory_manager = unittest.mock.AsyncMock()
        agent = src.domain.agent.AdkAgent(memory_manager=memory_manager)

        with unittest.mock.patch("src.domain.adk_agent.build_adk_agent") as mock_build_agent:
            events = [
                event
                async for event in agent.chat_stream(
                    session_id="conv-1",
                    message="Hello",
                )
            ]

        memory_manager.recall_all.assert_not_called()
        mock_build_agent.assert_not_called()

        final_chunks = [
            event["content"]
            for event in events
            if isinstance(event, dict) and event.get("type") == "final_response_chunk"
        ]
        assert len(final_chunks) == 1
        assert "HKI knowledge" in final_chunks[0]
        assert not any(
            isinstance(event, dict) and event.get("type") == "tool_call" for event in events
        )

        metadata_events = [
            event["metadata"]
            for event in events
            if isinstance(event, dict) and event.get("type") == "response_metadata"
        ]
        assert len(metadata_events) == 1
        assert metadata_events[0]["direct_response"] is True
        assert metadata_events[0]["model"] == "direct_response"
