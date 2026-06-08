// ─── Simulation Trace System ──────────────────────────────────────────────────
//
// Each trace is a sequence of events that play back in real-time through the
// visualizer. Events carry: which edge fired, latency, payload, and status.
// The useTracePlayback hook schedules these events and feeds them as topology
// signal annotations to <NeuralOrchestrator>.

export type TraceEventType =
  | "dispatch" // orchestrator → agent
  | "tool_call" // agent → tool
  | "store" // agent/tool → persist
  | "response" // return leg
  | "error" // fault
  | "heartbeat"; // keep-alive / no payload

export type TraceStatus = "ok" | "degraded" | "error" | "timeout";

export interface TraceEvent {
  id: string;
  ts: number; // ms offset from trace start
  from: string; // node id
  to: string; // node id
  type: TraceEventType;
  latencyMs: number;
  status: TraceStatus;
  label: string; // human-readable event name
  payload?: Record<string, unknown>;
}

export interface SimTrace {
  id: string;
  name: string;
  description: string;
  durationMs: number;
  events: TraceEvent[];
}

// ─── HKI Runtime trace ────────────────────────────────────────────────────────

export const HKI_TRACE: SimTrace = {
  id: "hki-runtime",
  name: "HKI Runtime — RAG Query",
  description:
    "End-to-end RAPTOR query with JWT validation, vector retrieval, and audit logging.",
  durationMs: 12000,
  events: [
    {
      id: "e01",
      ts: 0,
      from: "tool-3",
      to: "orch-1",
      type: "dispatch",
      latencyMs: 18,
      status: "ok",
      label: "JWT validated",
      payload: { domain: "retail", sub: "usr_7f2a" },
    },
    {
      id: "e02",
      ts: 120,
      from: "orch-1",
      to: "agent-2",
      type: "dispatch",
      latencyMs: 32,
      status: "ok",
      label: "Knowledge query",
      payload: { query: "q4 margin trends", top_k: 8 },
    },
    {
      id: "e03",
      ts: 280,
      from: "agent-2",
      to: "tool-2",
      type: "tool_call",
      latencyMs: 210,
      status: "ok",
      label: "Vector search",
      payload: { collection: "finance", k: 8 },
    },
    {
      id: "e04",
      ts: 520,
      from: "tool-2",
      to: "agent-2",
      type: "response",
      latencyMs: 14,
      status: "ok",
      label: "Chunks retrieved",
      payload: { chunks: 8, max_score: 0.94 },
    },
    {
      id: "e05",
      ts: 620,
      from: "agent-2",
      to: "orch-1",
      type: "response",
      latencyMs: 28,
      status: "ok",
      label: "Context assembled",
      payload: { tokens: 1840 },
    },
    {
      id: "e06",
      ts: 750,
      from: "orch-1",
      to: "agent-1",
      type: "dispatch",
      latencyMs: 35,
      status: "ok",
      label: "Ingest supplementary",
      payload: { source: "earnings_q4" },
    },
    {
      id: "e07",
      ts: 900,
      from: "agent-1",
      to: "tool-1",
      type: "tool_call",
      latencyMs: 180,
      status: "ok",
      label: "Graph write",
      payload: { node: "Document", rels: 3 },
    },
    {
      id: "e08",
      ts: 1100,
      from: "tool-1",
      to: "agent-1",
      type: "response",
      latencyMs: 12,
      status: "ok",
      label: "Graph updated",
      payload: { committed: true },
    },
    {
      id: "e09",
      ts: 1200,
      from: "agent-1",
      to: "persist-1",
      type: "store",
      latencyMs: 44,
      status: "ok",
      label: "Audit log",
      payload: { event: "ingestion.complete" },
    },
    {
      id: "e10",
      ts: 1400,
      from: "orch-1",
      to: "agent-3",
      type: "dispatch",
      latencyMs: 29,
      status: "ok",
      label: "Analytics query",
      payload: { metric: "margin_delta" },
    },
    {
      id: "e11",
      ts: 1540,
      from: "agent-3",
      to: "tool-1",
      type: "tool_call",
      latencyMs: 290,
      status: "degraded",
      label: "Cypher query (slow)",
      payload: { query: "MATCH (d:Document) WHERE d.quarter=$q", slow: true },
    },
    {
      id: "e12",
      ts: 1900,
      from: "tool-1",
      to: "agent-3",
      type: "response",
      latencyMs: 18,
      status: "degraded",
      label: "Query result (partial)",
      payload: { rows: 12, cache_hit: false },
    },
    {
      id: "e13",
      ts: 2050,
      from: "agent-3",
      to: "orch-1",
      type: "response",
      latencyMs: 22,
      status: "ok",
      label: "Metrics ready",
      payload: { margin_delta: "+2.3pp" },
    },
    {
      id: "e14",
      ts: 2200,
      from: "orch-1",
      to: "agent-2",
      type: "dispatch",
      latencyMs: 30,
      status: "ok",
      label: "Re-rank context",
      payload: { strategy: "raptor" },
    },
    {
      id: "e15",
      ts: 2380,
      from: "agent-2",
      to: "orch-1",
      type: "response",
      latencyMs: 25,
      status: "ok",
      label: "Summary ready",
      payload: { tokens: 420, faithfulness: 0.97 },
    },
    {
      id: "e16",
      ts: 2500,
      from: "orch-1",
      to: "persist-2",
      type: "store",
      latencyMs: 55,
      status: "ok",
      label: "Envelope sealed",
      payload: { domain: "retail", sig: "hki_v1" },
    },
    {
      id: "e17",
      ts: 2700,
      from: "agent-2",
      to: "persist-2",
      type: "store",
      latencyMs: 40,
      status: "ok",
      label: "Response cached",
      payload: { ttl: 300, key: "rag:q4:retail" },
    },
    // Second cycle — live update
    {
      id: "e18",
      ts: 3500,
      from: "tool-3",
      to: "orch-1",
      type: "heartbeat",
      latencyMs: 12,
      status: "ok",
      label: "JWT refresh",
    },
    {
      id: "e19",
      ts: 3700,
      from: "orch-1",
      to: "agent-1",
      type: "dispatch",
      latencyMs: 28,
      status: "ok",
      label: "Background ingest",
      payload: { batch: 3 },
    },
    {
      id: "e20",
      ts: 3900,
      from: "agent-1",
      to: "tool-1",
      type: "tool_call",
      latencyMs: 160,
      status: "ok",
      label: "Batch write",
    },
    {
      id: "e21",
      ts: 4200,
      from: "agent-1",
      to: "persist-1",
      type: "store",
      latencyMs: 38,
      status: "ok",
      label: "Batch audit",
    },
    {
      id: "e22",
      ts: 4800,
      from: "tool-3",
      to: "orch-1",
      type: "error",
      latencyMs: 8,
      status: "error",
      label: "JWT expired",
      payload: { code: 401, reason: "exp" },
    },
    {
      id: "e23",
      ts: 4820,
      from: "orch-1",
      to: "persist-1",
      type: "store",
      latencyMs: 30,
      status: "ok",
      label: "Rejection logged",
      payload: { event: "auth.rejected" },
    },
    {
      id: "e24",
      ts: 5200,
      from: "tool-3",
      to: "orch-1",
      type: "dispatch",
      latencyMs: 15,
      status: "ok",
      label: "JWT re-validated",
    },
    {
      id: "e25",
      ts: 5400,
      from: "orch-1",
      to: "agent-2",
      type: "dispatch",
      latencyMs: 31,
      status: "ok",
      label: "Resume query",
    },
    {
      id: "e26",
      ts: 5600,
      from: "agent-2",
      to: "tool-2",
      type: "tool_call",
      latencyMs: 195,
      status: "ok",
      label: "Vector search (cached)",
      payload: { cache_hit: true, latency_saved: 215 },
    },
    {
      id: "e27",
      ts: 5900,
      from: "tool-2",
      to: "agent-2",
      type: "response",
      latencyMs: 11,
      status: "ok",
      label: "Cache hit",
    },
    {
      id: "e28",
      ts: 6100,
      from: "agent-2",
      to: "orch-1",
      type: "response",
      latencyMs: 22,
      status: "ok",
      label: "Context served (cache)",
    },
    {
      id: "e29",
      ts: 6300,
      from: "orch-1",
      to: "persist-2",
      type: "store",
      latencyMs: 44,
      status: "ok",
      label: "Envelope sealed",
    },
  ],
};

// ─── Pipeline trace ───────────────────────────────────────────────────────────

export const PIPELINE_TRACE: SimTrace = {
  id: "pipeline",
  name: "Ingestion Pipeline",
  description:
    "Document ingestion: chunk → enrich → embed → index into Neo4j and vector store.",
  durationMs: 10000,
  events: [
    {
      id: "p01",
      ts: 0,
      from: "gate",
      to: "ingest",
      type: "dispatch",
      latencyMs: 22,
      status: "ok",
      label: "Document received",
      payload: { name: "Q4_Earnings.pdf", size_kb: 842 },
    },
    {
      id: "p02",
      ts: 150,
      from: "ingest",
      to: "chunk",
      type: "tool_call",
      latencyMs: 340,
      status: "ok",
      label: "Chunking",
      payload: { strategy: "recursive", chunk_size: 512 },
    },
    {
      id: "p03",
      ts: 520,
      from: "chunk",
      to: "enrich",
      type: "response",
      latencyMs: 18,
      status: "ok",
      label: "Chunks ready",
      payload: { n: 32, avg_tokens: 486 },
    },
    {
      id: "p04",
      ts: 600,
      from: "enrich",
      to: "ner",
      type: "tool_call",
      latencyMs: 480,
      status: "ok",
      label: "NER extraction",
      payload: { model: "en_core_web_trf" },
    },
    {
      id: "p05",
      ts: 1150,
      from: "ner",
      to: "enrich",
      type: "response",
      latencyMs: 14,
      status: "ok",
      label: "Entities extracted",
      payload: { entities: 47, types: ["ORG", "MONEY", "DATE"] },
    },
    {
      id: "p06",
      ts: 1250,
      from: "enrich",
      to: "index",
      type: "dispatch",
      latencyMs: 26,
      status: "ok",
      label: "Enriched chunks",
      payload: { n: 32 },
    },
    {
      id: "p07",
      ts: 1380,
      from: "index",
      to: "embed",
      type: "tool_call",
      latencyMs: 920,
      status: "ok",
      label: "Embedding",
      payload: { model: "text-embedding-3-large", dims: 3072 },
    },
    {
      id: "p08",
      ts: 2380,
      from: "embed",
      to: "vector",
      type: "store",
      latencyMs: 210,
      status: "ok",
      label: "Upsert to VectorDB",
      payload: { upserted: 32, collection: "finance_q4" },
    },
    {
      id: "p09",
      ts: 2650,
      from: "index",
      to: "neo4j",
      type: "store",
      latencyMs: 340,
      status: "ok",
      label: "Graph write",
      payload: { nodes: 47, rels: 63, tx: "hki_tx_0482" },
    },
    {
      id: "p10",
      ts: 3100,
      from: "gate",
      to: "audit",
      type: "store",
      latencyMs: 44,
      status: "ok",
      label: "Ingestion audit",
      payload: { event: "doc.ingested", domain: "finance" },
    },
    // Second doc
    {
      id: "p11",
      ts: 3500,
      from: "gate",
      to: "ingest",
      type: "dispatch",
      latencyMs: 20,
      status: "ok",
      label: "Document received",
      payload: { name: "Market_Brief_Jan.pdf", size_kb: 312 },
    },
    {
      id: "p12",
      ts: 3650,
      from: "ingest",
      to: "chunk",
      type: "tool_call",
      latencyMs: 180,
      status: "ok",
      label: "Chunking",
    },
    {
      id: "p13",
      ts: 3870,
      from: "chunk",
      to: "enrich",
      type: "response",
      latencyMs: 15,
      status: "ok",
      label: "Chunks ready",
      payload: { n: 12 },
    },
    {
      id: "p14",
      ts: 3950,
      from: "enrich",
      to: "ner",
      type: "tool_call",
      latencyMs: 320,
      status: "degraded",
      label: "NER timeout (retry)",
      payload: { attempt: 1, timeout_ms: 300 },
    },
    {
      id: "p15",
      ts: 4310,
      from: "ner",
      to: "enrich",
      type: "response",
      latencyMs: 12,
      status: "ok",
      label: "Entities extracted (2nd try)",
      payload: { entities: 18 },
    },
    {
      id: "p16",
      ts: 4400,
      from: "enrich",
      to: "index",
      type: "dispatch",
      latencyMs: 22,
      status: "ok",
      label: "Enriched chunks",
    },
    {
      id: "p17",
      ts: 4530,
      from: "index",
      to: "embed",
      type: "tool_call",
      latencyMs: 450,
      status: "ok",
      label: "Embedding",
    },
    {
      id: "p18",
      ts: 5050,
      from: "embed",
      to: "vector",
      type: "store",
      latencyMs: 140,
      status: "ok",
      label: "Upsert to VectorDB",
      payload: { upserted: 12 },
    },
    {
      id: "p19",
      ts: 5250,
      from: "index",
      to: "neo4j",
      type: "store",
      latencyMs: 290,
      status: "ok",
      label: "Graph write",
      payload: { nodes: 18, rels: 24 },
    },
    {
      id: "p20",
      ts: 5600,
      from: "gate",
      to: "audit",
      type: "store",
      latencyMs: 40,
      status: "ok",
      label: "Ingestion audit",
    },
  ],
};

// ─── Minimal trace ────────────────────────────────────────────────────────────

export const MINIMAL_TRACE: SimTrace = {
  id: "minimal",
  name: "Minimal — Echo Agent",
  description:
    "Single-turn request/response through two agents and a shared tool.",
  durationMs: 5000,
  events: [
    {
      id: "m01",
      ts: 0,
      from: "orch",
      to: "a1",
      type: "dispatch",
      latencyMs: 24,
      status: "ok",
      label: "Task dispatched",
      payload: { task: "summarise" },
    },
    {
      id: "m02",
      ts: 150,
      from: "a1",
      to: "t1",
      type: "tool_call",
      latencyMs: 280,
      status: "ok",
      label: "Tool invoked",
      payload: { fn: "summarise_text" },
    },
    {
      id: "m03",
      ts: 460,
      from: "t1",
      to: "a1",
      type: "response",
      latencyMs: 16,
      status: "ok",
      label: "Tool response",
    },
    {
      id: "m04",
      ts: 540,
      from: "a1",
      to: "p1",
      type: "store",
      latencyMs: 38,
      status: "ok",
      label: "Result stored",
    },
    {
      id: "m05",
      ts: 640,
      from: "a1",
      to: "orch",
      type: "response",
      latencyMs: 22,
      status: "ok",
      label: "Agent done",
    },
    {
      id: "m06",
      ts: 760,
      from: "orch",
      to: "a2",
      type: "dispatch",
      latencyMs: 26,
      status: "ok",
      label: "Verify task",
      payload: { task: "verify" },
    },
    {
      id: "m07",
      ts: 900,
      from: "a2",
      to: "t1",
      type: "tool_call",
      latencyMs: 190,
      status: "ok",
      label: "Cross-check",
    },
    {
      id: "m08",
      ts: 1120,
      from: "t1",
      to: "a2",
      type: "response",
      latencyMs: 14,
      status: "ok",
      label: "Check passed",
    },
    {
      id: "m09",
      ts: 1200,
      from: "a2",
      to: "p1",
      type: "store",
      latencyMs: 36,
      status: "ok",
      label: "Audit logged",
    },
    {
      id: "m10",
      ts: 1300,
      from: "a2",
      to: "orch",
      type: "response",
      latencyMs: 18,
      status: "ok",
      label: "Verified",
    },
    {
      id: "m11",
      ts: 2000,
      from: "orch",
      to: "a1",
      type: "dispatch",
      latencyMs: 24,
      status: "ok",
      label: "Follow-up task",
    },
    {
      id: "m12",
      ts: 2150,
      from: "a1",
      to: "t1",
      type: "tool_call",
      latencyMs: 240,
      status: "ok",
      label: "Tool invoked",
    },
    {
      id: "m13",
      ts: 2420,
      from: "t1",
      to: "a1",
      type: "error",
      latencyMs: 8,
      status: "error",
      label: "Tool error",
      payload: { code: 500, msg: "context_overflow" },
    },
    {
      id: "m14",
      ts: 2450,
      from: "a1",
      to: "orch",
      type: "response",
      latencyMs: 20,
      status: "error",
      label: "Retrying...",
    },
    {
      id: "m15",
      ts: 2600,
      from: "orch",
      to: "a1",
      type: "dispatch",
      latencyMs: 22,
      status: "ok",
      label: "Retry (truncated)",
      payload: { truncated: true },
    },
    {
      id: "m16",
      ts: 2750,
      from: "a1",
      to: "t1",
      type: "tool_call",
      latencyMs: 220,
      status: "ok",
      label: "Tool invoked (retry)",
    },
    {
      id: "m17",
      ts: 3000,
      from: "t1",
      to: "a1",
      type: "response",
      latencyMs: 15,
      status: "ok",
      label: "Success",
    },
    {
      id: "m18",
      ts: 3100,
      from: "a1",
      to: "p1",
      type: "store",
      latencyMs: 35,
      status: "ok",
      label: "Stored",
    },
    {
      id: "m19",
      ts: 3200,
      from: "a1",
      to: "orch",
      type: "response",
      latencyMs: 19,
      status: "ok",
      label: "Done",
    },
  ],
};

export const TRACES: Record<string, SimTrace> = {
  hki: HKI_TRACE,
  pipeline: PIPELINE_TRACE,
  minimal: MINIMAL_TRACE,
};

// ─── Playback hook ────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";

export interface PlaybackState {
  events: TraceEvent[]; // events that have fired so far
  cursor: number; // index into trace.events
  running: boolean;
  elapsed: number; // ms from start
}

export function useTracePlayback(trace: SimTrace, speed = 1.0) {
  const [state, setState] = useState<PlaybackState>({
    events: [],
    cursor: 0,
    running: false,
    elapsed: 0,
  });
  const startWall = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const traceRef = useRef(trace);
  traceRef.current = trace;

  const tick = useCallback(() => {
    const now = performance.now();
    const elapsed = (now - startWall.current) * speed;
    const t = traceRef.current;

    setState(prev => {
      let cursor = prev.cursor;
      const fired: TraceEvent[] = [];
      while (cursor < t.events.length && t.events[cursor]!.ts <= elapsed) {
        fired.push(t.events[cursor]!);
        cursor++;
      }
      if (fired.length === 0 && cursor === prev.cursor) return prev;
      return {
        events: [...prev.events, ...fired],
        cursor,
        running: cursor < t.events.length,
        elapsed,
      };
    });

    if (elapsed < trace.durationMs) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setState(prev => ({ ...prev, running: false }));
    }
  }, [speed, trace.durationMs]);

  const start = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    startWall.current = performance.now();
    setState({ events: [], cursor: 0, running: true, elapsed: 0 });
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setState({ events: [], cursor: 0, running: false, elapsed: 0 });
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // restart on trace change
  useEffect(() => {
    start();
  }, [trace.id, start]);

  return { ...state, start, reset };
}

// ─── Stat helpers ─────────────────────────────────────────────────────────────

export function traceStats(events: TraceEvent[]) {
  const ok = events.filter(e => e.status === "ok").length;
  const errors = events.filter(e => e.status === "error").length;
  const degraded = events.filter(e => e.status === "degraded").length;
  const avgLatency = events.length
    ? Math.round(events.reduce((s, e) => s + e.latencyMs, 0) / events.length)
    : 0;
  return { ok, errors, degraded, total: events.length, avgLatency };
}
