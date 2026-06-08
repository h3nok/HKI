import { useState } from "react";
import { NeuralOrchestrator, myelinTheme } from "@myelin/react";
import type { OrchestratorTopology } from "@myelin/core";
import { Badge, Button, cn } from "@hki/ui";
import {
  Network,
  Zap,
  Database,
  Cpu,
  ArrowRight,
  ShieldCheck,
  GitBranch,
  Layers,
  Box,
} from "lucide-react";
import { useLocation } from "wouter";
import { m } from "../theme.js";
import { CodeBlock } from "../components/CodeBlock.js";

// ─── Static topology for preview ─────────────────────────────────────────────

const OVERVIEW_TOPO: OrchestratorTopology = {
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
};

const toHex = (n: number) => "#" + n.toString(16).padStart(6, "0");
const MYELIN_SWATCHES = [
  { label: "orchestrator", value: myelinTheme.nodes.orchestrator },
  { label: "agent", value: myelinTheme.nodes.agent },
  { label: "tool", value: myelinTheme.nodes.tool },
  { label: "persist", value: myelinTheme.nodes.persist },
];

// ─── Primitives ───────────────────────────────────────────────────────────────

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div
      className={cn(
        m.inset,
        "inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 border border-border/20"
      )}
    >
      <span className="text-lg font-black tracking-tight text-foreground">
        {value}
      </span>
      <span className={m.muted}>{label}</span>
    </div>
  );
}

function ThemePresetCard() {
  return (
    <div className={cn(m.inset, "rounded-2xl border border-primary/15 p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={m.label}>Theme preset</p>
          <p className={cn(m.heading, "mt-1 text-base")}>myelinTheme</p>
        </div>
        <Badge
          variant="outline"
          className="border-primary/25 bg-primary/10 text-primary text-xs"
        >
          primary token
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {MYELIN_SWATCHES.map(swatch => (
          <div
            key={swatch.label}
            className="flex items-center gap-2 rounded-xl border border-border/35 bg-card/50 px-2.5 py-2"
          >
            <span
              className="h-5 w-5 shrink-0 rounded-lg shadow-sm"
              style={{
                background: toHex(swatch.value),
                boxShadow: `0 0 14px ${toHex(swatch.value)}55`,
              }}
            />
            <span className={cn(m.mono, "truncate text-[10px]")}>
              {swatch.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type IconTone = "brand" | "neutral";
const ICON_CLASSES: Record<IconTone, string> = {
  brand: "border border-primary/18 bg-primary/12 text-primary",
  neutral: "border border-border/55 bg-muted/40 text-muted-foreground",
};

function FeatureCard({
  icon: Icon,
  title,
  body,
  tone = "neutral",
}: {
  icon: typeof Network;
  title: string;
  body: string;
  tone?: IconTone;
}) {
  return (
    <div
      className={cn(
        m.card,
        "flex flex-col gap-4 rounded-xl px-4 py-4 border border-border/70"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-[14px]",
          ICON_CLASSES[tone]
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.5} />
      </div>
      <div className="space-y-1">
        <p className={m.heading}>{title}</p>
        <p className={m.muted}>{body}</p>
      </div>
    </div>
  );
}

function InvariantRow({
  index,
  title,
  body,
}: {
  index: number;
  title: string;
  body: string;
}) {
  return (
    <div
      className={cn(
        m.inset,
        "flex items-start gap-3.5 rounded-xl px-4 py-3.5 border border-border/20"
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/18 bg-primary/12 text-[10px] font-bold text-primary mt-0.5">
        {index}
      </span>
      <div className="space-y-0.5">
        <p className={m.heading}>{title}</p>
        <p className={m.muted}>{body}</p>
      </div>
    </div>
  );
}

// ─── Quick-start code ─────────────────────────────────────────────────────────

const QUICK_START = `import { NeuralOrchestrator, myelinTheme } from '@myelin/react'
import type { OrchestratorTopology } from '@myelin/core'

const topology: OrchestratorTopology = {
  nodes: [
    { id: 'orch', role: 'orchestrator', label: 'Gateway', rel: 'root'   },
    { id: 'a1',   role: 'agent',        label: 'Agent',   rel: 'worker' },
    { id: 't1',   role: 'tool',         label: 'Tool',    rel: 'util'   },
  ],
  edges: [
    { source: 'orch', target: 'a1' },
    { source: 'a1',   target: 't1' },
  ],
}

export function MyViz() {
  return <NeuralOrchestrator theme={myelinTheme} topology={topology} />
}`;

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LandingPage() {
  const [, setLocation] = useLocation();
  const [ready] = useState(true);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-8">
      <section
        className={cn(
          m.card,
          "overflow-hidden rounded-3xl border border-border/60"
        )}
      >
        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div
              className="absolute inset-0 opacity-80"
              style={{
                background:
                  "radial-gradient(circle at top left, color-mix(in srgb, var(--primary) 18%, transparent), transparent 42%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--foreground) 8%, transparent), transparent 36%)",
              }}
            />
            <div className="relative space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-primary/20 bg-primary/8 text-primary text-xs font-semibold"
                >
                  myelinTheme
                </Badge>
                <Badge variant="outline" className="text-xs">
                  agentic primitives
                </Badge>
                <Badge variant="outline" className="text-xs">
                  HKI shell native
                </Badge>
              </div>

              <div className="space-y-3 max-w-2xl">
                <p className={cn(m.label, "text-primary")}>
                  HKI visualization engine
                </p>
                <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Myelin is the agentic visualization engine.
                </h1>
                <p
                  className={cn(
                    m.subtext,
                    "max-w-2xl text-sm sm:text-base leading-6"
                  )}
                >
                  Live 3D topology for orchestrators, agents, tools, memory,
                  cache, and audit boundaries. Myelin carries its own primary
                  theme preset while using the same HKI sidebar, panel, border,
                  typography, and surface primitives as the agentic app.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  size="sm"
                  onClick={() => setLocation("/demo")}
                  className="gap-1.5"
                >
                  Open demo <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation("/themes")}
                >
                  Theme system
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                <StatPill value="1" label="theme preset" />
                <StatPill value="4" label="agentic roles" />
                <StatPill value="64" label="signal slots" />
                <StatPill value="1" label="draw call" />
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 lg:border-l lg:border-t-0">
            <div
              className={cn(m.inset, "h-full rounded-none p-6 sm:p-8 lg:p-10")}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={m.label}>Live preview</p>
                    <p className={cn(m.heading, "mt-1 text-base")}>
                      Myelin preset in the HKI shell
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLocation("/demo")}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    Full demo <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                {ready && (
                  <div
                    className={cn(
                      m.card,
                      "relative overflow-hidden rounded-2xl border border-border/70"
                    )}
                    style={{ height: 360 }}
                  >
                    <NeuralOrchestrator
                      theme={myelinTheme}
                      topology={OVERVIEW_TOPO}
                      bare
                    />
                  </div>
                )}

                <ThemePresetCard />

                <p className={cn(m.muted, "text-[11px]")}>
                  Same app primitives, distinct Myelin preset. The graph renders
                  from stable topology IDs so labels can evolve without breaking
                  signal routing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div
          className={cn(
            m.card,
            "rounded-2xl border border-border/60 p-5 lg:col-span-2"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={m.label}>Capabilities</p>
              <p className={cn(m.heading, "mt-1 text-base")}>
                Agentic visualization engine
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <FeatureCard
              icon={Network}
              tone="brand"
              title="OrchestratorTopology"
              body="Typed graph: nodes, edges, roles, weights. Source of truth for all rendering."
            />
            <FeatureCard
              icon={Layers}
              tone="brand"
              title="NeuralOrchestrator"
              body="React component backed by raw Three.js. Zero React Three Fiber overhead."
            />
            <FeatureCard
              icon={Zap}
              tone="neutral"
              title="Signal buffer"
              body="64-slot ring buffer. Signals travel edges in real time. No runtime allocations."
            />
            <FeatureCard
              icon={Database}
              tone="neutral"
              title="Deterministic layout"
              body="mulberry32(seed) RNG. Same topology renders identically on every mount."
            />
            <FeatureCard
              icon={Cpu}
              tone="neutral"
              title="Single draw call"
              body="All edges as one LineSegments with vertex colors. Scales to hundreds of edges."
            />
            <FeatureCard
              icon={Box}
              tone="neutral"
              title="Clean boundaries"
              body="@myelin/core has zero deps. @myelin/react never imports from apps/*."
            />
          </div>
        </div>

        <div className={cn(m.card, "rounded-2xl border border-border/60 p-5")}>
          <div>
            <p className={m.label}>Invariants</p>
            <p className={cn(m.heading, "mt-1 text-base")}>
              Rules that must never be violated
            </p>
          </div>
          <div className="mt-4 space-y-2">
            <InvariantRow
              index={1}
              title="Deterministic layout"
              body="buildGraph() uses mulberry32(seed). Never Math.random() for layout."
            />
            <InvariantRow
              index={2}
              title="No React state in the render loop"
              body="RAF callback uses useRef only. setState calls are throttled to ≤5/s."
            />
            <InvariantRow
              index={3}
              title="Single draw call for edges"
              body="One LineSegments with vertexColors. Never per-edge Line objects."
            />
            <InvariantRow
              index={4}
              title="Fixed signal buffer"
              body="MAX_SIG = 64. Reuse slots via .active flag. Never grow at runtime."
            />
            <InvariantRow
              index={5}
              title="Theme colors from the theme object only"
              body="Read theme.nodes[role], theme.edges.hot. Never hardcode hex in component logic."
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
        <div className={cn(m.card, "rounded-2xl border border-border/60 p-5")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={m.label}>Quick start</p>
              <p className={cn(m.heading, "mt-1 text-base")}>
                Minimal working example
              </p>
            </div>
          </div>
          <div className="mt-4">
            <CodeBlock code={QUICK_START} language="tsx" />
          </div>
          <div
            className={cn(
              m.inset,
              "mt-4 flex items-start gap-3 rounded-xl px-4 py-4 border border-primary/15"
            )}
          >
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div className="space-y-0.5">
              <p className={m.heading}>HKI-compatible</p>
              <p className={m.muted}>
                NeuralOrchestrator is envelope-neutral. Pass HKI topology from
                your orchestrator context and the visualization inherits domain
                state automatically.
              </p>
            </div>
          </div>
        </div>

        <div className={cn(m.card, "rounded-2xl border border-border/60 p-5")}>
          <div>
            <p className={m.label}>Package anatomy</p>
            <p className={cn(m.heading, "mt-1 text-base")}>What lives where</p>
          </div>
          <div className="mt-4 space-y-2">
            {[
              {
                pkg: "@myelin/core",
                icon: Box,
                desc: "NodeRole, OrchestratorTopology, TopologyNode — canonical types. Zero runtime deps.",
              },
              {
                pkg: "@myelin/react",
                icon: Layers,
                desc: "NeuralOrchestrator component, theme system, myelinTheme, hkiTheme, neuralTheme.",
              },
              {
                pkg: "myelin-showcase",
                icon: GitBranch,
                desc: "This app. Standalone Vite dev environment for visual iteration.",
              },
            ].map(row => {
              const Icon = row.icon;
              return (
                <div
                  key={row.pkg}
                  className={cn(
                    m.inset,
                    "flex items-start gap-3.5 rounded-xl px-3.5 py-3 border border-border/20"
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/16 bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        m.mono,
                        "text-foreground font-semibold text-xs"
                      )}
                    >
                      {row.pkg}
                    </p>
                    <p className={cn(m.muted, "mt-0.5")}>{row.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
