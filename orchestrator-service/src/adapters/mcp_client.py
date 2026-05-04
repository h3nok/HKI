"""
MCP Client Adapter — connects the orchestrator to MCP tool servers.

Replaces the inline ToolRegistry with dynamic tool discovery and execution
via the Model Context Protocol. Each MCP server exposes tools that the
orchestrator discovers at startup and invokes during the ReAct loop.

Architecture:
  Orchestrator  ──MCP──▸  retail-tools (stdio, local dev)
                ──MCP──▸  retail-tools (streamable-http, GKE)
                ──MCP──▸  knowledge-tools (streamable-http, GKE)

The adapter maintains persistent connections to all configured MCP servers
and provides the same interface as the old ToolRegistry (list_definitions_openai,
execute) so the orchestrator doesn't need to change its core loop.
"""

from __future__ import annotations

import json
import os
import time
import contextlib
import dataclasses
import typing

import mcp.client.session
import mcp.client.stdio
import mcp.client.streamable_http
import mcp.types

import src.core.logging
import src.domain.models

# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════


@dataclasses.dataclass
class MCPServerConfig:
    """Configuration for a single MCP server connection.

    stdio mode:  command + args (local subprocess)
    HTTP mode:   url (remote Streamable HTTP endpoint)
    """

    name: str
    # stdio transport
    command: str | None = None
    args: list[str] = dataclasses.field(default_factory=list)
    env: dict[str, str] | None = None
    cwd: str | None = None
    # HTTP transport
    url: str | None = None
    headers: dict[str, str] | None = None

    @property
    def transport(self) -> str:
        return "http" if self.url else "stdio"


def parse_mcp_config(config_json: str | None = None) -> list[MCPServerConfig]:
    """
    Parse MCP server configuration from JSON string or environment variable.

    Expected format (MCP_SERVERS env var or config_json):

        HTTP (local or deployed MCP server):
    {
      "retail-tools": {
                "url": "http://retail-tools-mcp:8100/mcp"
      }
    }

    HTTP (GKE / production):
    {
      "retail-tools": {
        "url": "http://retail-tools-mcp:8100/mcp"
      }
    }
    """
    raw: str = config_json or os.environ.get("MCP_SERVERS", "")
    if not raw:
        return []

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        src.core.logging.logger.warning(
            "Invalid MCP_SERVERS JSON",
            extra={"error": str(exc)},
        )
        return []

    configs: list[MCPServerConfig] = []
    for name, spec in data.items():
        if not isinstance(spec, dict):
            src.core.logging.logger.warning(
                "Skipping invalid MCP server config",
                extra={"name": name},
            )
            continue

        has_url: bool = "url" in spec
        has_command: bool = "command" in spec
        if not has_url and not has_command:
            src.core.logging.logger.warning(
                "MCP server config needs 'url' or 'command'",
                extra={"name": name},
            )
            continue

        configs.append(MCPServerConfig(
            name=name,
            command=spec.get("command"),
            args=spec.get("args", []),
            env=spec.get("env"),
            cwd=spec.get("cwd"),
            url=spec.get("url"),
            headers=spec.get("headers"),
        ))

    return configs


# ═══════════════════════════════════════════════════════════════════════════════
# MCP Tool Registry — drop-in replacement for the old ToolRegistry
# ═══════════════════════════════════════════════════════════════════════════════


class MCPToolRegistry:
    """
    Connects to MCP servers, discovers tools, and executes them.

    Provides the same interface as the old ToolRegistry so the orchestrator's
    ReAct loop doesn't need to change.
    """

    def __init__(self) -> None:
        self._exit_stack: contextlib.AsyncExitStack[bool | None] = contextlib.AsyncExitStack()
        self._sessions: dict[str, mcp.client.session.ClientSession] = {}
        # Maps tool_name → (server_name, mcp_tool)
        self._tools: dict[str, tuple[str, mcp.types.Tool]] = {}
        self._connected = False

    async def connect(self, configs: list[MCPServerConfig]) -> None:
        """Connect to all configured MCP servers and discover their tools."""
        for config in configs:
            try:
                await self._connect_server(config)
            except Exception as exc:
                src.core.logging.logger.error(
                    "Failed to connect to MCP server",
                    extra={"server": config.name, "error": str(exc)},
                )

        tool_names: list[str] = list(self._tools.keys())
        server_count: int = len(self._sessions)
        src.core.logging.logger.info(
            "MCP tool registry initialized",
            extra={
                "servers": server_count,
                "tools": tool_names,
                "total_tools": len(tool_names),
            },
        )
        self._connected = True

    async def _connect_server(self, config: MCPServerConfig) -> None:
        """Connect to a single MCP server via stdio or HTTP transport."""
        if config.url:
            await self._connect_http(config)
        else:
            await self._connect_stdio(config)

    async def _connect_stdio(self, config: MCPServerConfig) -> None:
        """Connect via stdio (local subprocess)."""
        server_params = mcp.client.stdio.StdioServerParameters(
            command=config.command,
            args=config.args,
            env={**os.environ, **(config.env or {})},
            cwd=config.cwd,
        )

        transport: tuple[MemoryObjectReceiveStream[SessionMessage | Exception], MemoryObjectSendStream[SessionMessage]] = await self._exit_stack.enter_async_context(
            mcp.client.stdio.stdio_client(server_params)
        )
        read_stream, write_stream = transport

        session: mcp.client.session.ClientSession = await self._exit_stack.enter_async_context(
            mcp.client.session.ClientSession(read_stream, write_stream)
        )

        await self._discover_tools(config, session)

    async def _connect_http(self, config: MCPServerConfig) -> None:
        """Connect via Streamable HTTP (GKE / production)."""
        transport: tuple[MemoryObjectReceiveStream[SessionMessage | Exception], MemoryObjectSendStream[SessionMessage], Callable[[], str | None]] = await self._exit_stack.enter_async_context(
            mcp.client.streamable_http.streamablehttp_client(
                url=config.url,
                headers=config.headers,
            )
        )
        read_stream, write_stream, _get_session_id = transport

        session: mcp.client.session.ClientSession = await self._exit_stack.enter_async_context(
            mcp.client.session.ClientSession(read_stream, write_stream)
        )

        await self._discover_tools(config, session)

    async def _discover_tools(
        self, config: MCPServerConfig, session: mcp.client.session.ClientSession
    ) -> None:
        """Initialize session, discover tools, and register them."""
        await session.initialize()

        tools_result: mcp.types.ListToolsResult = await session.list_tools()
        for tool in tools_result.tools:
            if tool.name in self._tools:
                src.core.logging.logger.warning(
                    "Duplicate MCP tool name — later server wins",
                    extra={
                        "tool": tool.name,
                        "server": config.name,
                        "previous_server": self._tools[tool.name][0],
                    },
                )
            self._tools[tool.name] = (config.name, tool)

        self._sessions[config.name] = session

        src.core.logging.logger.info(
            "MCP server connected",
            extra={
                "server": config.name,
                "transport": config.transport,
                "tools": [t.name for t in tools_result.tools],
            },
        )

    # ── ToolRegistry-compatible interface ─────────────────────────────────

    def list_definitions(self) -> list[src.domain.models.ToolDef]:
        """Return tool definitions in the internal ToolDef format."""
        defs = []
        for _server_name, mcp_tool in self._tools.values():
            defs.append(_mcp_tool_to_tooldef(mcp_tool))
        return defs

    def list_definitions_openai(self) -> list[dict[str, typing.Any]]:
        """Export in OpenAI function-calling format for LLM invocation."""
        return [defn.model_dump() for defn in self.list_definitions()]

    def get_names(self) -> list[str]:
        return list(self._tools.keys())

    async def execute(self, call: src.domain.models.ToolCallRequest) -> src.domain.models.ToolCallResult:
        """Execute a tool via its MCP server. Returns result or error."""
        entry: tuple[str, Tool] | None = self._tools.get(call.name)
        if entry is None:
            return src.domain.models.ToolCallResult(
                tool_call_id=call.id,
                name=call.name,
                output=None,
                error=f"Unknown tool: {call.name}",
            )

        server_name, _mcp_tool = entry
        session: mcp.client.session.ClientSession | None = self._sessions.get(server_name)
        if session is None:
            return src.domain.models.ToolCallResult(
                tool_call_id=call.id,
                name=call.name,
                output=None,
                error=f"MCP server not connected: {server_name}",
            )

        start: float = time.perf_counter()
        try:
            result: mcp.types.CallToolResult = await session.call_tool(call.name, call.arguments)
            duration_ms: float = (time.perf_counter() - start) * 1000

            if result.isError:
                error_text: str = _extract_text(result.content)
                src.core.logging.logger.error(
                    "MCP tool error",
                    extra={
                        "tool": call.name,
                        "server": server_name,
                        "error": error_text,
                    },
                )
                return src.domain.models.ToolCallResult(
                    tool_call_id=call.id,
                    name=call.name,
                    output=None,
                    error=error_text,
                    duration_ms=duration_ms,
                )

            # Extract output — MCP returns content blocks, we need a dict/str
            output = _extract_output(result.content)

            src.core.logging.logger.info(
                "MCP tool executed",
                extra={
                    "tool": call.name,
                    "server": server_name,
                    "duration_ms": round(duration_ms, 1),
                },
            )
            return src.domain.models.ToolCallResult(
                tool_call_id=call.id,
                name=call.name,
                output=output,
                duration_ms=duration_ms,
            )

        except Exception as exc:
            duration_ms: float = (time.perf_counter() - start) * 1000
            src.core.logging.logger.error(
                "MCP tool execution failed",
                extra={
                    "tool": call.name,
                    "server": server_name,
                    "error": str(exc),
                },
            )
            return src.domain.models.ToolCallResult(
                tool_call_id=call.id,
                name=call.name,
                output=None,
                error=str(exc),
                duration_ms=duration_ms,
            )

    async def close(self) -> None:
        """Disconnect from all MCP servers."""
        await self._exit_stack.aclose()
        self._sessions.clear()
        self._tools.clear()
        self._connected = False
        src.core.logging.logger.info("MCP tool registry closed")

    @property
    def is_connected(self) -> bool:
        return self._connected

    @property
    def server_count(self) -> int:
        return len(self._sessions)

    @property
    def tool_count(self) -> int:
        return len(self._tools)


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _mcp_tool_to_tooldef(mcp_tool: mcp.types.Tool) -> src.domain.models.ToolDef:
    """Convert an MCP Tool to the orchestrator's internal ToolDef format."""
    # MCP inputSchema is a JSON Schema object (same as OpenAI parameters)
    parameters: dict[str, Any] = mcp_tool.inputSchema or {
        "type": "object",
        "properties": {},
    }

    return src.domain.models.ToolDef(
        function=src.domain.models.ToolFunctionDef(
            name=mcp_tool.name,
            description=mcp_tool.description or "",
            parameters=parameters,
        )
    )


def _extract_text(content: list) -> str:
    """Extract text from MCP content blocks."""
    parts = []
    for block in content:
        if hasattr(block, "text"):
            parts.append(block.text)
        elif hasattr(block, "data"):
            parts.append(str(block.data))
    return "\n".join(parts) if parts else "Unknown error"


def _extract_output(content: list) -> typing.Any:
    """Extract structured output from MCP content blocks."""
    texts = []
    for block in content:
        if hasattr(block, "text"):
            texts.append(block.text)
        elif hasattr(block, "data"):
            return block.data

    combined: str = "\n".join(texts)

    # Try to parse as JSON (most tools return structured data)
    try:
        return json.loads(combined)
    except (json.JSONDecodeError, ValueError):
        return combined
