from __future__ import annotations

import json
import time
import uuid
from typing import Any

import aiosqlite

DB_PATH = "agentgraph.db"

CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS runs (
    id          TEXT PRIMARY KEY,
    query       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'running',
    hki_domain  TEXT,
    model       TEXT,
    confidence  REAL,
    started_at  REAL NOT NULL,
    ended_at    REAL,
    metadata    TEXT
);

CREATE TABLE IF NOT EXISTS events (
    id          TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    seq         INTEGER NOT NULL,
    event_type  TEXT NOT NULL,
    payload     TEXT NOT NULL,
    received_at REAL NOT NULL,
    UNIQUE(run_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_events_run_id ON events(run_id, seq);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_domain ON runs(hki_domain);
"""


async def init_db(db_path: str = DB_PATH) -> None:
    async with aiosqlite.connect(db_path) as db:
        await db.executescript(CREATE_TABLES)
        await db.commit()


async def create_run(
    run_id: str | None,
    query: str,
    hki_domain: str | None = None,
    db_path: str = DB_PATH,
) -> str:
    rid = run_id or str(uuid.uuid4())
    async with aiosqlite.connect(db_path) as db:
        await db.execute(
            "INSERT OR IGNORE INTO runs (id, query, status, hki_domain, started_at) VALUES (?, ?, 'running', ?, ?)",
            (rid, query, hki_domain, time.time() * 1000),
        )
        await db.commit()
    return rid


async def insert_events(
    run_id: str,
    events: list[dict[str, Any]],
    db_path: str = DB_PATH,
) -> int:
    async with aiosqlite.connect(db_path) as db:
        # Get current max seq for this run
        async with db.execute("SELECT COALESCE(MAX(seq), -1) FROM events WHERE run_id = ?", (run_id,)) as cur:
            row = await cur.fetchone()
            max_seq = row[0] if row else -1

        now = time.time() * 1000
        inserted = 0
        for i, event in enumerate(events):
            seq = max_seq + 1 + i
            try:
                await db.execute(
                    "INSERT OR IGNORE INTO events (id, run_id, seq, event_type, payload, received_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), run_id, seq, event.get("type", "unknown"), json.dumps(event), now),
                )
                inserted += 1
            except Exception:
                pass

        # Auto-update run status based on events
        event_types = {e.get("type") for e in events}
        if "final_response" in event_types or "response_metadata" in event_types:
            # Extract model/confidence from response_metadata if present
            for event in events:
                if event.get("type") == "response_metadata":
                    meta = event.get("metadata", {})
                    confidence = meta.get("confidence")
                    model = meta.get("model")
                    hki_domain = meta.get("scope")
                    await db.execute(
                        "UPDATE runs SET status='success', ended_at=?, confidence=?, model=?, hki_domain=COALESCE(hki_domain, ?) WHERE id=?",
                        (now, confidence, model, hki_domain, run_id),
                    )
                    break
            else:
                await db.execute(
                    "UPDATE runs SET status='success', ended_at=? WHERE id=?",
                    (now, run_id),
                )

        await db.commit()
    return inserted


async def get_run_events(run_id: str, db_path: str = DB_PATH) -> list[dict[str, Any]]:
    async with aiosqlite.connect(db_path) as db:
        async with db.execute(
            "SELECT payload FROM events WHERE run_id=? ORDER BY seq ASC", (run_id,)
        ) as cur:
            rows = await cur.fetchall()
    return [json.loads(row[0]) for row in rows]


async def list_runs(
    limit: int = 20,
    domain: str | None = None,
    status: str | None = None,
    db_path: str = DB_PATH,
) -> list[dict[str, Any]]:
    conditions = []
    params: list[Any] = []
    if domain:
        conditions.append("hki_domain = ?")
        params.append(domain)
    if status:
        conditions.append("status = ?")
        params.append(status)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    params.append(limit)

    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            f"""
            SELECT r.id, r.query, r.status, r.hki_domain, r.model, r.confidence,
                   r.started_at, r.ended_at,
                   COUNT(e.id) as node_count
            FROM runs r
            LEFT JOIN events e ON e.run_id = r.id AND e.event_type NOT IN ('prompt_stack','final_response_chunk','response_metadata')
            {where}
            GROUP BY r.id
            ORDER BY r.started_at DESC
            LIMIT ?
            """,
            params,
        ) as cur:
            rows = await cur.fetchall()
    return [dict(row) for row in rows]


async def get_run_meta(run_id: str, db_path: str = DB_PATH) -> dict[str, Any] | None:
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM runs WHERE id=?", (run_id,)) as cur:
            row = await cur.fetchone()
    return dict(row) if row else None


async def delete_run(run_id: str, db_path: str = DB_PATH) -> bool:
    async with aiosqlite.connect(db_path) as db:
        await db.execute("DELETE FROM runs WHERE id=?", (run_id,))
        await db.commit()
    return True
