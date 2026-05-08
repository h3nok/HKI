#!/usr/bin/env python3
"""
Agent Engine — Deploy / Query / Manage CLI

Commands:
    deploy    Deploy AgentEngineWrapper to Vertex AI Agent Engine
    query     Send a test query to a deployed engine
    list      List all deployed Agent Engine instances
    delete    Delete a deployed Agent Engine instance
    info      Print resource name and metadata for a deployed instance

Usage:
    uv run python scripts/deploy_agent_engine.py deploy \\
        --project demo-retail-genai-324 \\
        --location us-central1 \\
        --display-name "orchestrator-adk-agent-v1"

    uv run python scripts/deploy_agent_engine.py query \\
        --resource-name "projects/.../reasoningEngines/..." \\
        --message "What is the return policy?"

    uv run python scripts/deploy_agent_engine.py list \\
        --project demo-retail-genai-324 --location us-central1

Prerequisites:
    pip install google-cloud-aiplatform[agent_engines]>=1.112
    gcloud auth application-default login
"""

from __future__ import annotations

import argparse
import asyncio
import collections.abc
import json
import os
import pathlib
import sys
import typing

from google.cloud.aiplatform.base import VertexAiResourceNoun
from vertexai.reasoning_engines._reasoning_engines import ReasoningEngine

# ── Ensure project root is on sys.path so src.* imports resolve ───────────
_repo_root: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _repo_root not in sys.path:
    sys.path.insert(0, _repo_root)


# ── Required packages ─────────────────────────────────────────────────────


def _require_vertexai() -> None:
    try:
        import vertexai  # noqa: F401
        from vertexai.preview import reasoning_engines  # noqa: F401
    except ImportError:
        print(
            "ERROR: google-cloud-aiplatform[agent_engines] is not installed.\n"
            "Run:  pip install 'google-cloud-aiplatform[agent_engines]>=1.112'",
            file=sys.stderr,
        )
        sys.exit(1)


# ── Pinned requirements for the remote Agent Engine runtime ──────────────
# Keep these in sync with pyproject.toml dependencies.
AGENT_ENGINE_REQUIREMENTS: list[str] = [
    "google-cloud-aiplatform[agent_engines]>=1.112",
    "fastapi>=0.115.0",
    "httpx>=0.27.0",
    "litellm>=1.50.0",
    "redis>=5.0.0",
    "pydantic>=2.9.0",
    "pydantic-settings>=2.5.0",
    "python-json-logger>=2.0.0",
    "mcp>=1.0.0",
    "PyJWT>=2.8.0",
]

SERVICE_ROOT: pathlib.Path = pathlib.Path(_repo_root).resolve()
SHARED_ROOT: pathlib.Path = (SERVICE_ROOT.parent / "shared").resolve()


def _stage_source_packages() -> tuple[list[str], pathlib.Path]:
    """Stage orchestrator ``src`` and ``shared`` packages for Agent Engine upload.

    Vertex SDK's ``tar.add(path)`` preserves the full directory structure in the
    tarball.  Absolute paths like ``/Users/.../orchestrator-service`` produce
    deeply nested entries that the runtime cannot resolve for ``import src``.

    To get **flat** tarball entries the caller must ``os.chdir(staging_dir)``
    before calling ``ReasoningEngine.create``.  The staging directory contains::

        src/            ← orchestrator application code
        shared/         ← hki-shared library code

    Both appear as top-level packages in the extracted tarball, so
    ``from src.adapters.agent_engine import ...`` and
    ``from shared.config import ...`` resolve correctly.
    """
    import shutil
    import tempfile

    staging = pathlib.Path(tempfile.mkdtemp(prefix="ae_stage_"))

    def _ignore_pycache(directory: str, contents: list[str]) -> list[str]:
        return [c for c in contents if c == "__pycache__"]

    shutil.copytree(SERVICE_ROOT / "src", staging / "src", ignore=_ignore_pycache)
    shutil.copytree(SHARED_ROOT / "shared", staging / "shared", ignore=_ignore_pycache)

    extra_packages: list[str] = ["src", "shared"]
    return extra_packages, staging


# ═══════════════════════════════════════════════════════════════════════════
# Commands
# ═══════════════════════════════════════════════════════════════════════════


def cmd_deploy(args: argparse.Namespace) -> None:
    """Deploy AgentEngineWrapper to Vertex AI Agent Engine."""
    _require_vertexai()
    import vertexai
    from vertexai.preview import reasoning_engines

    from src.core.config import settings
    class DeployableAgentWrapper:
        """
        Deployment-safe wrapper.

        Critical: this class avoids importing `src.*` at module load/pickle time.
        Agent Engine control-plane must unpickle this object before user packages
        are guaranteed importable. We lazily import the real wrapper on first call.
        """

        def __init__(
            self,
            redis_url: str,
            llm_gateway_url: str,
            agent_model: str,
            knowledge_api_url: str,
        ) -> None:
            self._redis_url: str = redis_url
            self._llm_gateway_url: str = llm_gateway_url
            self._agent_model: str = agent_model
            self._knowledge_api_url: str = knowledge_api_url
            self._delegate = None

        def set_up(self) -> None:
            # No-op: defer all imports and initialization.
            return

        async def _ensure_delegate(self) -> None:
            if self._delegate is not None:
                return
            from src.adapters.agent_engine import AgentEngineWrapper

            self._delegate = AgentEngineWrapper(
                redis_url=self._redis_url,
                llm_gateway_url=self._llm_gateway_url,
                agent_model=self._agent_model,
                knowledge_api_url=self._knowledge_api_url,
            )
            self._delegate.set_up()

        async def query(
            self,
            *,
            message: str,
            session_id: str = "default",
            scope: str = "global",
            stream_config: dict[str, object] | None = None,
        ) -> dict[str, object]:
            await self._ensure_delegate()
            return await self._delegate.query(
                message=message,
                session_id=session_id,
                scope=scope,
                stream_config=stream_config,
            )

        async def stream_query(
            self,
            *,
            message: str,
            session_id: str = "default",
            scope: str = "global",
            stream_config: dict[str, object] | None = None,
        ) -> collections.abc.Generator[dict[str, typing.Any], typing.Any, None]:
            await self._ensure_delegate()
            async for chunk in self._delegate.stream_query(
                message=message,
                session_id=session_id,
                scope=scope,
                stream_config=stream_config,
            ):
                yield chunk

        def query_sync(
            self,
            *,
            message: str,
            session_id: str = "default",
            scope: str = "global",
            stream_config: dict[str, object] | None = None,
        ) -> dict[str, object]:
            return asyncio.run(
                self.query(
                    message=message,
                    session_id=session_id,
                    scope=scope,
                    stream_config=stream_config,
                )
            )

    # Use provided staging bucket or construct default from project ID
    staging_bucket: typing.Any | str = args.staging_bucket or f"gs://{args.project}-agent-engine"

    vertexai.init(project=args.project, location=args.location, staging_bucket=staging_bucket)

    redis_url: typing.Any | str = args.redis_url or settings.REDIS_URL
    # On Agent Engine, default to ADC-direct model calls (no HTTP gateway hop).
    llm_gateway_url: typing.Any | str = args.llm_gateway_url if args.llm_gateway_url is not None else ""
    agent_model: typing.Any | str = args.agent_model or settings.AGENT_MODEL
    knowledge_api_url: typing.Any | str = args.knowledge_api_url or settings.KNOWLEDGE_API_URL

    print(f"Deploying AgentEngineWrapper to {args.project}/{args.location}…")
    print(f"  display_name    : {args.display_name}")
    print(f"  llm_gateway_url : {llm_gateway_url}")
    print(f"  agent_model     : {agent_model}")
    print(f"  redis_url       : {redis_url}")

    extra_packages, staging_dir = _stage_source_packages()
    print(f"  extra_packages  : {extra_packages}")
    print(f"  staging_dir     : {staging_dir}")

    wrapper = DeployableAgentWrapper(
        redis_url=redis_url,
        llm_gateway_url=llm_gateway_url,
        agent_model=agent_model,
        knowledge_api_url=knowledge_api_url,
    )

    saved_cwd: str = os.getcwd()
    os.chdir(staging_dir)
    try:
        remote: ReasoningEngine = reasoning_engines.ReasoningEngine.create(
            wrapper,
            requirements=AGENT_ENGINE_REQUIREMENTS,
            extra_packages=extra_packages,
            display_name=args.display_name,
            description=(
                "Orchestrator ADK Agent hosted on Vertex AI Agent Engine. "
                "Wraps AdkAgent with memory, tiered caching, corrective RAG, "
                "and MCP tool calling."
            ),
        )
    finally:
        os.chdir(saved_cwd)

    resource_name: str = remote.resource_name
    print("\nDeployed successfully!")
    print(f"  resource_name: {resource_name}")
    print("\nSave this for future use:")
    print(f"  AGENT_ENGINE_RESOURCE_NAME={resource_name}")

    # Persist to a local file for convenience
    out_path: str = os.path.join(os.path.dirname(__file__), ".agent_engine_resource")
    with open(out_path, "w") as f:
        f.write(resource_name)
    print(f"  (also saved to {out_path})")


def cmd_query(args: argparse.Namespace) -> None:
    """Send a test query to a deployed Agent Engine instance."""
    _require_vertexai()
    import vertexai
    from vertexai.preview import reasoning_engines

    vertexai.init(project=args.project, location=args.location)

    resource_name: typing.Any | str = args.resource_name or _load_resource_name()
    print(f"Querying: {resource_name}")
    print(f"  message    : {args.message}")
    print(f"  session_id : {args.session_id}")
    print(f"  scope      : {args.scope}")

    remote = reasoning_engines.ReasoningEngine(resource_name)
    result = remote.query(
        message=args.message,
        session_id=args.session_id,
        scope=args.scope,
    )

    print("\n── Response ──────────────────────────────────────────────")
    print(result.get("final_response", "(no response)"))

    if args.verbose:
        print("\n── Events ────────────────────────────────────────────────")
        for event in result.get("events", []):
            print(json.dumps(event, indent=2, default=str))


def cmd_list(args: argparse.Namespace) -> None:
    """List all Agent Engine instances in the project."""
    _require_vertexai()
    import vertexai
    from vertexai.preview import reasoning_engines

    vertexai.init(project=args.project, location=args.location)

    engines: list[VertexAiResourceNoun] = reasoning_engines.ReasoningEngine.list()
    if not engines:
        print("No Agent Engine instances found.")
        return

    print(f"Found {len(engines)} Agent Engine instance(s):\n")
    for engine in engines:
        print(f"  {engine.display_name}")
        print(f"    resource_name : {engine.resource_name}")
        print(f"    create_time   : {engine.create_time}")
        print()


def cmd_delete(args: argparse.Namespace) -> None:
    """Delete a deployed Agent Engine instance."""
    _require_vertexai()
    import vertexai
    from vertexai.preview import reasoning_engines

    vertexai.init(project=args.project, location=args.location)

    resource_name: typing.Any | str = args.resource_name or _load_resource_name()

    if not args.yes:
        confirm: str = input(f"Delete {resource_name}? [y/N] ")
        if confirm.lower() != "y":
            print("Aborted.")
            return

    engine = reasoning_engines.ReasoningEngine(resource_name)
    engine.delete()
    print(f"Deleted: {resource_name}")


def cmd_info(args: argparse.Namespace) -> None:
    """Print metadata for a deployed Agent Engine instance."""
    _require_vertexai()
    import vertexai
    from vertexai.preview import reasoning_engines

    vertexai.init(project=args.project, location=args.location)

    resource_name: typing.Any | str = args.resource_name or _load_resource_name()
    engine = reasoning_engines.ReasoningEngine(resource_name)

    print(
        json.dumps(
            {
                "resource_name": engine.resource_name,
                "display_name": engine.display_name,
                "create_time": str(engine.create_time),
                "update_time": str(engine.update_time),
            },
            indent=2,
        )
    )


# ── Helpers ───────────────────────────────────────────────────────────────


def _load_resource_name() -> str:
    path: str = os.path.join(os.path.dirname(__file__), ".agent_engine_resource")
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    print(
        "ERROR: No --resource-name provided and no .agent_engine_resource file found.\n"
        "Run deploy first, or pass --resource-name explicitly.",
        file=sys.stderr,
    )
    sys.exit(1)


# ── CLI ───────────────────────────────────────────────────────────────────


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Vertex AI Agent Engine — deploy/query/manage CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    # Common args
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--project",
        default=os.environ.get("GCP_PROJECT_ID", "demo-retail-genai-324"),
        help="GCP project ID (default: $GCP_PROJECT_ID)",
    )
    common.add_argument(
        "--location",
        default=os.environ.get("GCP_LOCATION", "us-central1"),
        help="GCP region (default: $GCP_LOCATION or us-central1)",
    )

    sub: argparse._SubParsersAction[argparse.ArgumentParser] = parser.add_subparsers(dest="command", required=True)

    # deploy
    p_deploy: argparse.ArgumentParser = sub.add_parser("deploy", parents=[common], help="Deploy to Agent Engine")
    p_deploy.add_argument(
        "--display-name", default="orchestrator-adk-agent", help="Display name for the engine"
    )
    p_deploy.add_argument(
        "--staging-bucket",
        default=None,
        help="GCS bucket for staging (default: gs://{project}-agent-engine)",
    )
    p_deploy.add_argument("--redis-url", default=None, help="Redis URL (overrides settings)")
    p_deploy.add_argument(
        "--llm-gateway-url", default=None, help="LLM gateway URL (overrides settings)"
    )
    p_deploy.add_argument("--agent-model", default=None, help="Agent model (overrides settings)")
    p_deploy.add_argument(
        "--knowledge-api-url", default=None, help="Knowledge API URL (overrides settings)"
    )

    # query
    p_query: argparse.ArgumentParser = sub.add_parser("query", parents=[common], help="Query a deployed engine")
    p_query.add_argument("--resource-name", default=None, help="Agent Engine resource name")
    p_query.add_argument("--message", required=True, help="Message to send")
    p_query.add_argument("--session-id", default="test-session", help="Session ID")
    p_query.add_argument("--scope", default="global", help="Value stream scope")
    p_query.add_argument("--verbose", "-v", action="store_true", help="Print all SSE events")

    # list
    sub.add_parser("list", parents=[common], help="List deployed engines")

    # delete
    p_delete: argparse.ArgumentParser = sub.add_parser("delete", parents=[common], help="Delete a deployed engine")
    p_delete.add_argument("--resource-name", default=None, help="Agent Engine resource name")
    p_delete.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompt")

    # info
    p_info: argparse.ArgumentParser = sub.add_parser("info", parents=[common], help="Print engine metadata")
    p_info.add_argument("--resource-name", default=None, help="Agent Engine resource name")

    return parser


def main() -> None:
    parser: argparse.ArgumentParser = build_parser()
    args: argparse.Namespace = parser.parse_args()

    dispatch: dict[str, collections.abc.Callable[..., None]] = {
        "deploy": cmd_deploy,
        "query": cmd_query,
        "list": cmd_list,
        "delete": cmd_delete,
        "info": cmd_info,
    }
    dispatch[args.command](args)


if __name__ == "__main__":
    main()
