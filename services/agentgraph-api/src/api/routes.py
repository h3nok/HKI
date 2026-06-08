from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any, AsyncGenerator

import fastapi
import fastapi.responses

from ..domain import models, projector, storage

router = fastapi.APIRouter()

# SSE subscriber registry: run_id → list of asyncio.Queue
_subscribers: dict[str, list[asyncio.Queue[dict[str, Any] | None]]] = {}


def _notify(run_id: str, event: dict[str, Any]) -> None:
    for q in _subscribers.get(run_id, []):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass


# ─── Run management ───────────────────────────────────────────────────────────

@router.post("/runs", status_code=201)
async def create_run(body: models.CreateRunRequest) -> dict[str, str]:
    run_id = await storage.create_run(
        run_id=body.id,
        query=body.query,
        hki_domain=body.hki_domain,
    )
    return {"run_id": run_id}


@router.get("/runs")
async def list_runs(
    limit: int = fastapi.Query(20, ge=1, le=100),
    domain: str | None = fastapi.Query(None),
    status: str | None = fastapi.Query(None),
) -> dict[str, Any]:
    runs = await storage.list_runs(limit=limit, domain=domain, status=status)
    return {"runs": runs, "count": len(runs)}


@router.get("/runs/{run_id}")
async def get_run(run_id: str) -> models.AgentRun:
    meta = await storage.get_run_meta(run_id)
    if not meta:
        raise fastapi.HTTPException(status_code=404, detail="Run not found")
    events = await storage.get_run_events(run_id)
    run = projector.project_events(events, run_id=run_id, query=meta["query"])
    run.hki_domain = meta.get("hki_domain") or run.hki_domain
    run.model = meta.get("model") or run.model
    run.confidence = meta.get("confidence") or run.confidence
    return run


@router.get("/runs/{run_id}/summary")
async def get_run_summary(run_id: str) -> models.RunSummary:
    meta = await storage.get_run_meta(run_id)
    if not meta:
        raise fastapi.HTTPException(status_code=404, detail="Run not found")
    events = await storage.get_run_events(run_id)
    run = projector.project_events(events, run_id=run_id, query=meta["query"])

    tool_calls = [n for n in run.nodes if n.kind == "tool_call"]
    reflecting = next((n for n in run.nodes if n.kind == "reflecting"), None)
    response_node = next((n for n in run.nodes if n.kind == "response"), None)

    return models.RunSummary(
        total_ms=(run.end_ms or 0) - run.start_ms,
        tool_call_count=len(tool_calls),
        llm_calls=reflecting.tokens.get("llm_calls", 1) if reflecting and reflecting.tokens else (1 if run.nodes else 0),
        kb_hits=reflecting.tokens.get("kb_chunks_retrieved", 0) if reflecting and reflecting.tokens else 0,
        tokens_used=reflecting.tokens.get("total", 0) if reflecting and reflecting.tokens else 0,
        confidence=response_node.confidence if response_node else run.confidence,
        hki_domain=run.hki_domain or meta.get("hki_domain"),
        model=run.model or meta.get("model"),
        status=run.status,
    )


@router.post("/runs/{run_id}/diff/{run_id_b}")
async def diff_runs(run_id: str, run_id_b: str) -> dict[str, Any]:
    meta_a = await storage.get_run_meta(run_id)
    meta_b = await storage.get_run_meta(run_id_b)
    if not meta_a or not meta_b:
        raise fastapi.HTTPException(status_code=404, detail="Run not found")

    events_a = await storage.get_run_events(run_id)
    events_b = await storage.get_run_events(run_id_b)
    run_a = projector.project_events(events_a, run_id=run_id, query=meta_a["query"])
    run_b = projector.project_events(events_b, run_id=run_id_b, query=meta_b["query"])

    nodes_a = {n.id for n in run_a.nodes}
    nodes_b = {n.id for n in run_b.nodes}
    edges_a = {e.id for e in run_a.edges}
    edges_b = {e.id for e in run_b.edges}

    return {
        "diff": {
            "nodes": {
                "added": [n.model_dump() for n in run_b.nodes if n.id not in nodes_a],
                "removed": [n.id for n in run_a.nodes if n.id not in nodes_b],
            },
            "edges": {
                "added": [e.model_dump() for e in run_b.edges if e.id not in edges_a],
                "removed": [e.id for e in run_a.edges if e.id not in edges_b],
            },
        }
    }


@router.delete("/runs/{run_id}", status_code=204)
async def delete_run(run_id: str) -> None:
    await storage.delete_run(run_id)
    _subscribers.pop(run_id, None)


# ─── Event ingestion ──────────────────────────────────────────────────────────

@router.post("/runs/{run_id}/events", status_code=202)
async def ingest_events(run_id: str, body: models.IngestEventsRequest) -> dict[str, Any]:
    meta = await storage.get_run_meta(run_id)
    if not meta:
        raise fastapi.HTTPException(status_code=404, detail="Run not found — create it first via POST /runs")
    inserted = await storage.insert_events(run_id, body.events)
    for event in body.events:
        _notify(run_id, event)
    return {"inserted": inserted, "run_id": run_id}


# ─── SSE live stream ──────────────────────────────────────────────────────────

@router.get("/runs/{run_id}/stream")
async def stream_run(run_id: str) -> fastapi.responses.StreamingResponse:
    meta = await storage.get_run_meta(run_id)
    if not meta:
        raise fastapi.HTTPException(status_code=404, detail="Run not found")

    async def generator() -> AsyncGenerator[str, None]:
        existing = await storage.get_run_events(run_id)
        for event in existing:
            yield f"data: {json.dumps(event)}\n\n"

        if meta.get("status") in ("success", "error"):
            yield "data: [DONE]\n\n"
            return

        q: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue(maxsize=500)
        _subscribers.setdefault(run_id, []).append(q)
        try:
            while True:
                event = await asyncio.wait_for(q.get(), timeout=30)
                if event is None:
                    yield "data: [DONE]\n\n"
                    break
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") in ("final_response", "response_metadata"):
                    await asyncio.sleep(0.1)
                    yield "data: [DONE]\n\n"
                    break
        except asyncio.TimeoutError:
            yield "data: [KEEPALIVE]\n\n"
        finally:
            subs = _subscribers.get(run_id, [])
            if q in subs:
                subs.remove(q)

    return fastapi.responses.StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


# ─── Health ───────────────────────────────────────────────────────────────────

@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "agentgraph-api"}
