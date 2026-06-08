import React, { useState, useCallback } from "react";
import {
  NeuralOrchestrator,
  myelinTheme,
  hkiTheme,
  neuralTheme,
} from "@myelin/react";
import type { NeuralOrchestratorTheme } from "@myelin/react";
import type { OrchestratorTopology } from "@myelin/core";
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  ScrollArea,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  cn,
} from "@hki/ui";
import { Play, RotateCcw, Zap, Circle, AlertCircle, Clock } from "lucide-react";
import { m } from "../theme.js";
import { TRACES, useTracePlayback, traceStats } from "../data/traces.js";
import type { TraceEvent } from "../data/traces.js";

// ─── Topologies ───────────────────────────────────────────────────────────────

const TOPOLOGIES: Record<string, OrchestratorTopology> = {
  hki: {
    nodes: [
      {
        id: "orch-1",
        role: "orchestrator",
        label: "HKI Orchestrator",
        rel: "root",
      },
      { id: "agent-1", role: "agent", label: "Ingestion Agent", rel: "worker" },
      { id: "agent-2", role: "agent", label: "Knowledge Agent", rel: "worker" },
      { id: "agent-3", role: "agent", label: "Analytics Agent", rel: "worker" },
      { id: "tool-1", role: "tool", label: "Neo4j Write", rel: "storage" },
      { id: "tool-2", role: "tool", label: "Vector Store", rel: "storage" },
      { id: "tool-3", role: "tool", label: "JWT Validator", rel: "security" },
      { id: "persist-1", role: "persist", label: "Audit Log", rel: "durable" },
      {
        id: "persist-2",
        role: "persist",
        label: "Envelope Store",
        rel: "durable",
      },
    ],
    edges: [
      { source: "orch-1", target: "agent-1", weight: 1.0 },
      { source: "orch-1", target: "agent-2", weight: 1.0 },
      { source: "orch-1", target: "agent-3", weight: 0.8 },
      { source: "agent-1", target: "tool-1", weight: 0.9 },
      { source: "agent-2", target: "tool-2", weight: 0.9 },
      { source: "agent-3", target: "tool-1", weight: 0.6 },
      { source: "tool-3", target: "orch-1", weight: 0.7 },
      { source: "agent-1", target: "persist-1", weight: 0.5 },
      { source: "agent-2", target: "persist-2", weight: 0.5 },
      { source: "tool-1", target: "persist-2", weight: 0.4 },
    ],
  },
  pipeline: {
    nodes: [
      { id: "gate", role: "orchestrator", label: "Gateway", rel: "root" },
      { id: "ingest", role: "agent", label: "Ingest", rel: "stage" },
      { id: "enrich", role: "agent", label: "Enrich", rel: "stage" },
      { id: "index", role: "agent", label: "Index", rel: "stage" },
      { id: "embed", role: "tool", label: "Embedder", rel: "util" },
      { id: "chunk", role: "tool", label: "Chunker", rel: "util" },
      { id: "ner", role: "tool", label: "NER", rel: "util" },
      { id: "neo4j", role: "persist", label: "Neo4j", rel: "durable" },
      { id: "vector", role: "persist", label: "VectorDB", rel: "durable" },
      { id: "audit", role: "persist", label: "Audit", rel: "durable" },
    ],
    edges: [
      { source: "gate", target: "ingest", weight: 1.0 },
      { source: "ingest", target: "chunk", weight: 0.9 },
      { source: "ingest", target: "enrich", weight: 0.8 },
      { source: "enrich", target: "ner", weight: 0.9 },
      { source: "enrich", target: "index", weight: 0.8 },
      { source: "index", target: "embed", weight: 0.9 },
      { source: "embed", target: "vector", weight: 0.8 },
      { source: "index", target: "neo4j", weight: 0.7 },
      { source: "gate", target: "audit", weight: 0.4 },
      { source: "chunk", target: "enrich", weight: 0.5 },
    ],
  },
  minimal: {
    nodes: [
      { id: "orch", role: "orchestrator", label: "Orchestrator", rel: "root" },
      { id: "a1", role: "agent", label: "Agent A", rel: "worker" },
      { id: "a2", role: "agent", label: "Agent B", rel: "worker" },
      { id: "t1", role: "tool", label: "Tool", rel: "util" },
      { id: "p1", role: "persist", label: "Store", rel: "durable" },
    ],
    edges: [
      { source: "orch", target: "a1" },
      { source: "orch", target: "a2" },
      { source: "a1", target: "t1" },
      { source: "a2", target: "t1" },
      { source: "t1", target: "p1" },
    ],
  },
};

const TOPO_META: Record<string, { label: string; traceId: string }> = {
  hki: { label: "HKI Runtime", traceId: "hki" },
  pipeline: { label: "Pipeline", traceId: "pipeline" },
  minimal: { label: "Minimal", traceId: "minimal" },
};

const toHex = (n: number) => "#" + n.toString(16).padStart(6, "0");

// Three.js visualization palette — not UI colors
const THEME_OPTIONS: Array<{
  id: string;
  label: string;
  theme: NeuralOrchestratorTheme;
  dots: string[];
}> = [
  {
    id: "myelin",
    label: "Myelin",
    theme: myelinTheme,
    dots: [
      toHex(myelinTheme.nodes.orchestrator),
      toHex(myelinTheme.nodes.agent),
      toHex(myelinTheme.nodes.tool),
      toHex(myelinTheme.nodes.persist),
    ],
  },
  {
    id: "hki",
    label: "HKI Host",
    theme: hkiTheme,
    dots: [
      toHex(hkiTheme.nodes.orchestrator),
      toHex(hkiTheme.nodes.agent),
      toHex(hkiTheme.nodes.tool),
      toHex(hkiTheme.nodes.persist),
    ],
  },
  {
    id: "neural",
    label: "Neural",
    theme: neuralTheme,
    dots: [
      toHex(neuralTheme.nodes.orchestrator),
      toHex(neuralTheme.nodes.agent),
      toHex(neuralTheme.nodes.tool),
      toHex(neuralTheme.nodes.persist),
    ],
  },
];

const EVENT_ICON: Record<string, React.ElementType> = {
  dispatch: Zap,
  tool_call: Zap,
  store: Circle,
  response: Circle,
  error: AlertCircle,
  heartbeat: Clock,
};

// ─── Primitives ───────────────────────────────────────────────────────────────

function statusClass(status: string) {
  if (status === "ok") return m.statusOk;
  if (status === "error") return m.statusError;
  if (status === "degraded") return m.statusWarn;
  return m.statusIdle;
}

function StatTile({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: "ok" | "error";
}) {
  return (
    <div
      className={cn(m.inset, "rounded-xl px-3 py-2.5 border border-border/20")}
    >
      <p className={cn(m.mono, "uppercase tracking-widest text-[9px]")}>
        {label}
      </p>
      <p
        className={cn(
          "text-[15px] font-bold font-mono mt-0.5",
          status === "ok"
            ? m.statusOk
            : status === "error"
              ? m.statusError
              : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EventRow({
  event: ev,
  topology,
}: {
  event: TraceEvent;
  topology: OrchestratorTopology;
}) {
  const Icon = EVENT_ICON[ev.type] ?? Circle;
  const from = topology.nodes.find(n => n.id === ev.from);
  const to = topology.nodes.find(n => n.id === ev.to);
  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-muted/20 transition-colors">
      <Icon className={cn("size-3 mt-0.5 shrink-0", statusClass(ev.status))} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-foreground leading-tight truncate">
          {ev.label}
        </p>
        <p className={cn(m.mono, "mt-0.5 truncate text-[9px]")}>
          {from?.label ?? ev.from} → {to?.label ?? ev.to} · {ev.latencyMs}ms
        </p>
      </div>
    </div>
  );
}

function NodeInspector({
  id,
  topology,
  events,
  theme,
  onClose,
}: {
  id: string;
  topology: OrchestratorTopology;
  events: TraceEvent[];
  theme: NeuralOrchestratorTheme;
  onClose: () => void;
}) {
  const node = topology.nodes.find(n => n.id === id);
  if (!node) return null;

  const outEdges = topology.edges.filter(e => e.source === id);
  const inEdges = topology.edges.filter(e => e.target === id);
  const nodeEvents = events
    .filter(e => e.from === id || e.to === id)
    .slice(-8)
    .reverse();
  const accent = toHex(theme.nodes[node.role]);

  return (
    <div className="absolute bottom-5 left-5 w-72 z-50">
      <Card style={{ borderColor: `${accent}40` }}>
        <CardHeader className="pb-3 flex-row items-start justify-between space-y-0">
          <div>
            <p
              className={cn(m.mono, "uppercase tracking-widest mb-1")}
              style={{ color: accent }}
            >
              {node.role}
            </p>
            <CardTitle className="text-[16px]">{node.label}</CardTitle>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onClose}
            className="shrink-0 -mt-1 -mr-1"
          >
            ✕
          </Button>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Rel" value={node.rel} />
            <StatTile label="In" value={String(inEdges.length)} status="ok" />
            <StatTile label="Out" value={String(outEdges.length)} />
          </div>
          {outEdges.length > 0 && (
            <div>
              <p
                className={cn(
                  m.mono,
                  "uppercase tracking-widest text-[9px] mb-1.5"
                )}
              >
                Connects to
              </p>
              <div className="flex flex-wrap gap-1">
                {outEdges.map(e => {
                  const target = topology.nodes.find(n => n.id === e.target);
                  return (
                    <span
                      key={e.target}
                      className={cn(m.mono, "text-[9px] px-1.5 py-0.5 rounded")}
                      style={{
                        color: accent,
                        background: `${accent}14`,
                        border: `1px solid ${accent}28`,
                      }}
                    >
                      {target?.label ?? e.target}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {nodeEvents.length > 0 && (
            <>
              <Separator />
              <div>
                <p
                  className={cn(
                    m.mono,
                    "uppercase tracking-widest text-[9px] mb-1.5"
                  )}
                >
                  Recent events
                </p>
                <div className="space-y-1">
                  {nodeEvents.map(ev => {
                    const Icon = EVENT_ICON[ev.type] ?? Circle;
                    return (
                      <div key={ev.id} className="flex items-center gap-1.5">
                        <Icon
                          className={cn(
                            "size-2.5 shrink-0",
                            statusClass(ev.status)
                          )}
                        />
                        <span className="text-[10px] text-foreground truncate flex-1">
                          {ev.label}
                        </span>
                        <span className={cn(m.mono, "shrink-0 text-[9px]")}>
                          {ev.latencyMs}ms
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          <Tabs defaultValue="meta">
            <TabsList className="w-full grid grid-cols-2 h-7">
              <TabsTrigger value="meta" className="text-[10px]">
                Meta
              </TabsTrigger>
              <TabsTrigger value="id" className="text-[10px]">
                ID
              </TabsTrigger>
            </TabsList>
            <TabsContent value="meta" className="mt-2 space-y-1">
              {[
                ["role", node.role],
                ["rel", node.rel],
                ["edges", `${inEdges.length}↓ ${outEdges.length}↑`],
              ].map(([k2, v]) => (
                <div key={k2} className="flex justify-between">
                  <span className={m.mono}>{k2}</span>
                  <span className={cn(m.mono, "text-foreground")}>{v}</span>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="id" className="mt-2">
              <p className={cn(m.mono, "break-all")}>{node.id}</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DemoPage() {
  const [themeId, setThemeId] = useState("myelin");
  const [topoId, setTopoId] = useState("hki");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const activeTheme = THEME_OPTIONS.find(t => t.id === themeId)!.theme;
  const activeTopo = TOPOLOGIES[topoId]!;
  const activeTrace = TRACES[TOPO_META[topoId]!.traceId]!;

  const playback = useTracePlayback(activeTrace, 1.8);
  const stats = traceStats(playback.events);
  const handleNodeSelect = useCallback(
    (id: string | null) => setSelectedNode(id),
    []
  );

  return (
    <div
      className="flex overflow-hidden"
      style={{ height: "calc(100svh - 3.5rem)" }}
    >
      {/* ── Visualizer ────────────────────────────────────────────── */}
      <div className="flex-1 relative min-w-0">
        <NeuralOrchestrator
          theme={activeTheme}
          topology={activeTopo}
          onNodeSelect={handleNodeSelect}
        />
        {selectedNode && (
          <NodeInspector
            id={selectedNode}
            topology={activeTopo}
            events={playback.events}
            theme={activeTheme}
            onClose={() => setSelectedNode(null)}
          />
        )}
        {!selectedNode && (
          <p
            className={cn(
              m.mono,
              "absolute bottom-6 left-1/2 -translate-x-1/2 text-center pointer-events-none opacity-40"
            )}
          >
            Click any node to inspect · Scroll to zoom · Drag to orbit
          </p>
        )}
      </div>

      {/* ── Control panel ─────────────────────────────────────────── */}
      <aside className="w-72 flex flex-col border-l border-border bg-card overflow-hidden shrink-0">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between shrink-0">
          <span className={m.label}>Controls</span>
          <Badge
            variant={playback.running ? "default" : "outline"}
            className={cn(m.mono, "text-[9px]")}
          >
            {playback.running ? "LIVE" : "IDLE"}
          </Badge>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            <div>
              <p className={cn(m.label, "mb-2")}>Theme</p>
              <div className="grid grid-cols-2 gap-1.5">
                {THEME_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setThemeId(opt.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-2.5 rounded-lg border cursor-pointer transition-colors",
                      m.mono,
                      themeId === opt.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/20 text-muted-foreground hover:border-border/80"
                    )}
                  >
                    <div className="flex gap-1">
                      {opt.dots.map((c, i) => (
                        <span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <p className={cn(m.label, "mb-2")}>Topology</p>
              <div className="space-y-1">
                {Object.entries(TOPO_META).map(([key, meta]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTopoId(key)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-md border cursor-pointer transition-colors",
                      topoId === key
                        ? "border-primary/40 bg-primary/8 text-primary"
                        : "border-border/50 bg-muted/10 text-muted-foreground hover:border-border"
                    )}
                  >
                    <span className={m.mono}>{meta.label}</span>
                    <span className={cn(m.mono, "text-muted-foreground/50")}>
                      {TOPOLOGIES[key]!.nodes.length}n
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <p className={cn(m.label, "mb-2")}>Trace playback</p>
              <p className={cn(m.caption, "mb-3")}>{activeTrace.name}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={playback.start}
                  className="flex-1 gap-1.5"
                >
                  <Play className="size-3" /> Replay
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={playback.reset}>
                  <RotateCcw className="size-3.5" />
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <p className={cn(m.label, "mb-3")}>Session stats</p>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Events" value={String(stats.total)} />
                <StatTile label="Avg latency" value={`${stats.avgLatency}ms`} />
                <StatTile label="OK" value={String(stats.ok)} status="ok" />
                <StatTile
                  label="Errors"
                  value={String(stats.errors)}
                  status={stats.errors > 0 ? "error" : undefined}
                />
              </div>
            </div>

            <Separator />

            <div>
              <p className={cn(m.label, "mb-2")}>Event feed</p>
              <div className="space-y-0.5">
                {[...playback.events]
                  .reverse()
                  .slice(0, 30)
                  .map(ev => (
                    <EventRow key={ev.id} event={ev} topology={activeTopo} />
                  ))}
                {playback.events.length === 0 && (
                  <p className={cn(m.caption, "italic opacity-50")}>
                    Waiting for trace…
                  </p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </aside>
    </div>
  );
}
