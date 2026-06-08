/**
 * Engineering Page — Myelin live topology visualizer embedded inside the
 * admin control plane shell. Reads --primary from the active theme so the
 * visualization always matches the platform brand.
 */

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  createThemeFromPrimaryToken,
  hkiTheme,
  type NeuralOrchestratorTheme,
} from "@myelin/react";
import type { OrchestratorTopology } from "@myelin/core";
import {
  Activity,
  Braces,
  CheckCircle2,
  Cpu,
  Database,
  Fingerprint,
  GitBranch,
  KeyRound,
  LockKeyhole,
  Network,
  Radio,
  Route,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@hki/ui";

import { BrandLoader } from "@/components/ui/brand-loader";
import {
  GovernanceFrame,
  GovernanceRegistry,
} from "./components/GovernanceFrame";
import { a, type AdminTone } from "./theme";

const NeuralOrchestratorLazy = lazy(() =>
  import("@myelin/react").then(m => ({ default: m.NeuralOrchestrator }))
);

const ENGINEERING_TOPOLOGY: OrchestratorTopology = {
  nodes: [
    {
      id: "gateway-edge",
      role: "orchestrator",
      label: "Gateway Edge",
      rel: "MINTS_ENVELOPE",
      metadata: { plane: "edge", invariant: "signed scope" },
    },
    {
      id: "hki-runtime",
      role: "orchestrator",
      label: "HKI Runtime",
      rel: "EVALUATES_POLICY",
      metadata: { plane: "runtime", invariant: "single active domain" },
    },
    {
      id: "agent-router",
      role: "agent",
      label: "Agent Router",
      rel: "NARROWS_SCOPE",
      metadata: { plane: "agent", invariant: "handoff narrowing" },
    },
    {
      id: "knowledge-retrieval",
      role: "tool",
      label: "Knowledge Retrieval",
      rel: "ASSERTS_VISIBILITY",
      metadata: { plane: "knowledge", invariant: "exact match" },
    },
    {
      id: "tool-gateway",
      role: "tool",
      label: "MCP Tool Guard",
      rel: "EVALUATES_TARGET",
      metadata: { plane: "tools", invariant: "fail closed" },
    },
    {
      id: "domain-cache",
      role: "persist",
      label: "Domain Cache",
      rel: "DERIVES_KEY",
      metadata: { plane: "cache", invariant: "domain scoped" },
    },
    {
      id: "audit-ledger",
      role: "persist",
      label: "Audit Ledger",
      rel: "RECORDS_EVIDENCE",
      metadata: { plane: "audit", invariant: "traceable boundary" },
    },
  ],
  edges: [
    { source: "gateway-edge", target: "hki-runtime", weight: 1 },
    { source: "hki-runtime", target: "agent-router", weight: 0.86 },
    { source: "agent-router", target: "knowledge-retrieval", weight: 0.78 },
    { source: "agent-router", target: "tool-gateway", weight: 0.66 },
    { source: "knowledge-retrieval", target: "domain-cache", weight: 0.62 },
    { source: "tool-gateway", target: "audit-ledger", weight: 0.54 },
    { source: "domain-cache", target: "audit-ledger", weight: 0.48 },
    { source: "audit-ledger", target: "hki-runtime", weight: 0.38 },
  ],
};

const ENGINEERING_METRICS: Array<{
  label: string;
  value: string;
  tone: AdminTone;
}> = [
  { label: "Envelope", value: "L4", tone: "positive" },
  { label: "Topology", value: "7 nodes", tone: "primary" },
  { label: "Guards", value: "active", tone: "positive" },
  { label: "Edges", value: "8", tone: "neutral" },
];

const ENGINE_COMPONENTS: Array<{
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: AdminTone;
}> = [
  {
    id: "runtime",
    label: "Runtime Contract",
    description: "Every operation carries one signed HkiEnvelope.",
    icon: KeyRound,
    tone: "positive",
  },
  {
    id: "domain",
    label: "Domain Boundary",
    description: "Visibility resolves by normalized exact domain match.",
    icon: Fingerprint,
    tone: "primary",
  },
  {
    id: "handoff",
    label: "Agent Handoff",
    description: "Sub-agents receive narrowed child scope only.",
    icon: GitBranch,
    tone: "warning",
  },
  {
    id: "evidence",
    label: "Evidence Trail",
    description: "Cache, tool, and retrieval decisions land in audit.",
    icon: Database,
    tone: "neutral",
  },
];

const INVARIANTS = [
  "Single active domain",
  "Fail-closed envelope validation",
  "No body-scope override",
  "Domain-scoped cache derivation",
  "Artifact visibility assertion",
];

const SIGNAL_FEED = [
  {
    label: "Gateway minted envelope",
    meta: "edge -> runtime",
    tone: "positive",
  },
  {
    label: "Router narrowed active domain",
    meta: "agent handoff",
    tone: "primary",
  },
  {
    label: "MCP guard evaluated target",
    meta: "tool boundary",
    tone: "warning",
  },
  { label: "Audit ledger recorded trace", meta: "evidence", tone: "neutral" },
] satisfies Array<{ label: string; meta: string; tone: AdminTone }>;

function readPrimaryHex(): number | null {
  if (typeof document === "undefined") return null;
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();
  if (!val) return null;
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.color = val;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  const m = resolved.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
  return (
    (Math.max(0, Math.min(255, Number(m[1]))) << 16) |
    (Math.max(0, Math.min(255, Number(m[2]))) << 8) |
    Math.max(0, Math.min(255, Number(m[3])))
  );
}

export default function EngineeringPage() {
  const [theme, setTheme] = useState<NeuralOrchestratorTheme>(hkiTheme);
  const topologySummary = useMemo(() => {
    const nodes = ENGINEERING_TOPOLOGY.nodes.length;
    const edges = ENGINEERING_TOPOLOGY.edges.length;
    const persisted = ENGINEERING_TOPOLOGY.nodes.filter(
      node => node.role === "persist"
    ).length;
    return { nodes, edges, persisted };
  }, []);

  useEffect(() => {
    const refresh = () => {
      const hex = readPrimaryHex();
      if (hex != null) setTheme(createThemeFromPrimaryToken({ primary: hex }));
    };
    refresh();
    const obs = new MutationObserver(refresh);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    return () => obs.disconnect();
  }, []);

  return (
    <GovernanceFrame
      icon={Network}
      eyebrow="Engineering"
      title="Myelin Engine Map"
      description="Live topology surface for HKI runtime flow: gateway envelope, domain routing, retrieval, tools, cache, and audit evidence in one primary-token visual system."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              a.pillPrimary,
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Primary token bound
          </span>
          <span
            className={cn(
              a.pillPositive,
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
            )}
          >
            <Radio className="h-3.5 w-3.5" />
            Signal loop active
          </span>
        </div>
      }
      metrics={ENGINEERING_METRICS}
    >
      <div className="space-y-5">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <div
            className={cn(
              a.hero,
              "relative min-h-155 overflow-hidden p-3 sm:p-4"
            )}
          >
            <div className="relative z-10 mb-3 flex flex-wrap items-center justify-between gap-3 px-1 sm:px-2">
              <div>
                <div className={a.sectionEyebrow}>Topology viewport</div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                  HKI execution graph
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-right text-xs">
                <ViewportStat label="Nodes" value={topologySummary.nodes} />
                <ViewportStat label="Edges" value={topologySummary.edges} />
                <ViewportStat
                  label="Stores"
                  value={topologySummary.persisted}
                />
              </div>
            </div>

            <div className="relative z-10 h-130 overflow-hidden rounded-xl border border-border/60 bg-background/70 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_8%,transparent)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between border-b border-border/50 bg-card/72 px-4 py-2 text-xs text-muted-foreground backdrop-blur-md">
                <span className="inline-flex items-center gap-2 font-medium text-foreground">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                  Runtime signal fabric
                </span>
                <span>domain-scoped / fail-closed / audited</span>
              </div>
              <Suspense fallback={<BrandLoader variant="fullscreen" />}>
                <NeuralOrchestratorLazy
                  theme={theme}
                  topology={ENGINEERING_TOPOLOGY}
                  bare
                />
              </Suspense>
            </div>
          </div>

          <aside className="space-y-4">
            <section className={cn(a.card, "p-4")}>
              <PanelHeading
                icon={Cpu}
                eyebrow="Runtime stack"
                title="Engine components"
              />
              <div className="mt-4 space-y-3">
                {ENGINE_COMPONENTS.map(component => (
                  <ComponentRow key={component.id} {...component} />
                ))}
              </div>
            </section>

            <section className={cn(a.card, "p-4")}>
              <PanelHeading
                icon={Workflow}
                eyebrow="Signal feed"
                title="Boundary events"
              />
              <div className="mt-4 space-y-3">
                {SIGNAL_FEED.map(signal => (
                  <SignalRow key={signal.label} {...signal} />
                ))}
              </div>
            </section>
          </aside>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <GovernanceRegistry
            title="HKI Runtime Invariants"
            description="The Engineering view is organized around controls that must remain true for every agentic operation."
            countLabel="5 enforced"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {INVARIANTS.map(invariant => (
                <InvariantRow key={invariant} label={invariant} />
              ))}
            </div>
          </GovernanceRegistry>

          <GovernanceRegistry
            title="Topology Contracts"
            description="Myelin renders graph contracts by stable node IDs, so labels can change without breaking edge identity."
            countLabel={`${topologySummary.edges} relationships`}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {ENGINEERING_TOPOLOGY.nodes.slice(0, 6).map(node => (
                <TopologyNodeCard
                  key={node.id}
                  label={node.label}
                  role={node.role}
                  rel={node.rel}
                />
              ))}
            </div>
          </GovernanceRegistry>
        </div>
      </div>
    </GovernanceFrame>
  );
}

function ViewportStat({ label, value }: { label: string; value: number }) {
  return (
    <div className={cn(a.inset, "min-w-20 rounded-lg px-3 py-2")}>
      <div className="text-sm font-semibold text-foreground">{value}</div>
      <div className="mt-0.5 text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function PanelHeading({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={cn(
          a.iconPrimary,
          "flex h-10 w-10 items-center justify-center rounded-xl"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className={a.sectionEyebrow}>{eyebrow}</div>
        <h3 className="mt-1 text-base font-semibold text-foreground">
          {title}
        </h3>
      </div>
    </div>
  );
}

function ComponentRow({
  label,
  description,
  icon: Icon,
  tone,
}: {
  label: string;
  description: string;
  icon: LucideIcon;
  tone: AdminTone;
}) {
  return (
    <div className={cn(a.inset, "flex gap-3 rounded-xl p-3")}>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          tone === "positive"
            ? a.iconPositive
            : tone === "warning"
              ? a.iconWarning
              : tone === "primary"
                ? a.iconPrimary
                : a.iconNeutral
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function SignalRow({
  label,
  meta,
  tone,
}: {
  label: string;
  meta: string;
  tone: AdminTone;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          tone === "positive"
            ? "bg-emerald-500"
            : tone === "warning"
              ? "bg-amber-500"
              : tone === "primary"
                ? "bg-primary"
                : "bg-muted-foreground/50"
        )}
      />
      <div className="min-w-0 flex-1 border-b border-border/45 pb-3">
        <div className="truncate text-sm font-medium text-foreground">
          {label}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{meta}</div>
      </div>
    </div>
  );
}

function InvariantRow({ label }: { label: string }) {
  return (
    <div className={cn(a.inset, "flex items-center gap-3 rounded-xl p-3")}>
      <div
        className={cn(
          a.iconPositive,
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          enforced at runtime boundary
        </div>
      </div>
    </div>
  );
}

function TopologyNodeCard({
  label,
  role,
  rel,
}: {
  label: string;
  role: string;
  rel: string;
}) {
  const Icon =
    role === "persist"
      ? Database
      : role === "tool"
        ? Braces
        : role === "agent"
          ? Route
          : LockKeyhole;
  return (
    <div className={cn(a.inset, "rounded-xl p-3")}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            a.iconPrimary,
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {label}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{role}</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
            <span>{rel.toLowerCase().replaceAll("_", " ")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
