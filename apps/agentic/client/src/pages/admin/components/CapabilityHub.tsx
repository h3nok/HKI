import {
  BrainCircuit,
  ChevronRight,
  Cpu,
  Database,
  ShieldCheck,
  Zap,
  ExternalLink,
  BarChart3,
  Network,
  Route,
  type LucideIcon,
} from "lucide-react";
import { cn, HermeticCard, HKI_IRIS } from "@hki/ui";
import { useLocation } from "wouter";
import { a } from "../theme";

interface CapabilityHubProps {
  data: {
    knowledge: { docs: number; chunks: number; ok: boolean };
    orchestrator: { latency?: number; ok: boolean };
    memory: { conversations: number; ok: boolean };
    tooling: { totalCalls: number; ok: boolean };
    safety: { blocks: number; ok: boolean };
  };
}

interface Capability {
  id: string;
  name: string;
  icon: LucideIcon;
  status: "active" | "error" | "idle";
  metric: string;
  unit: string;
  description: string;
  color: string;
  href?: string;
  external?: boolean;
  deploymentScope?: "mvp";
  scopeTone?: "primary" | "critical";
}

export function CapabilityHub({ data }: CapabilityHubProps) {
  const [, setLocation] = useLocation();

  const capabilities: Capability[] = [
    {
      id: "knowledge",
      name: "Knowledge",
      icon: Database,
      status: data.knowledge.ok ? "active" : "error",
      metric: `${(data.knowledge.docs / 1000).toFixed(1)}k`,
      unit: "Docs",
      description: "Semantic RAG Pipeline",
      color: HKI_IRIS,
      href: "/knowledge",
      deploymentScope: "mvp",
      scopeTone: "primary",
    },
    {
      id: "orchestrator",
      name: "Orchestration",
      icon: Cpu,
      status: data.orchestrator.ok ? "active" : "error",
      metric: data.orchestrator.latency ? `${data.orchestrator.latency}` : "—",
      unit: "Latency (ms)",
      description: "Multi-Agent Planning",
      color: HKI_IRIS,
    },
    {
      id: "memory",
      name: "Memory",
      icon: BrainCircuit,
      status: data.memory.ok ? "active" : "idle",
      metric: `${data.memory.conversations}`,
      unit: "Threads",
      description: "Session Context Graph",
      color: "color-mix(in srgb, var(--primary) 72%, white)",
    },
    {
      id: "tooling",
      name: "Tool Hub",
      icon: Zap,
      status: data.tooling.ok ? "active" : "idle",
      metric: `${data.tooling.totalCalls}`,
      unit: "Executions",
      description: "MCP Plugin Registry",
      color:
        "color-mix(in srgb, var(--primary) 62%, var(--muted-foreground) 38%)",
    },
    {
      id: "safety",
      name: "Safety Hub",
      icon: ShieldCheck,
      status: data.safety.ok ? "active" : "idle",
      metric: `${data.safety.blocks}`,
      unit: "Blocks",
      description: "Guardrail Enforcement",
      color:
        "color-mix(in srgb, var(--destructive) 72%, var(--foreground) 28%)",
    },
    {
      id: "api-gateway",
      name: "API Gateway",
      icon: Network,
      status: "active" as const,
      metric: "124k",
      unit: "Req/min",
      description: "Edge Traffic Routing",
      color: "color-mix(in srgb, var(--primary) 82%, white)",
    },
    {
      id: "ai-gateway",
      name: "AI Gateway",
      icon: Route,
      status: "active" as const,
      metric: "1.2s",
      unit: "TTFT (ms)",
      description: "Model Routing & Fallback",
      color: "color-mix(in srgb, var(--primary) 58%, var(--foreground) 42%)",
      href: "https://aigateway.cilabs.np.hki.com/ui/",
      external: true,
      deploymentScope: "mvp",
      scopeTone: "primary",
    },
    {
      id: "observability",
      name: "Observability",
      icon: BarChart3,
      status: "active" as const,
      metric: "Live",
      unit: "Cloud Ops",
      description: "Logs, Traces & Metrics",
      color: "color-mix(in srgb, var(--primary) 68%, var(--destructive) 32%)",
    },
  ];

  return (
    <HermeticCard
      elevation="raised"
      size="md"
      interactive={false}
      className={cn(a.card, "flex flex-col overflow-hidden h-full")}
    >
      <div className="border-b border-border/30 px-5 py-4">
        <h3 className="text-sm font-medium text-foreground dark:text-foreground/78">
          Capability Matrix
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Knowledge Domains and AI Gateway are the launch surfaces for this
          deployment. The rest stay visible as platform context.
        </p>
      </div>

      <div className="flex flex-col flex-1 divide-y divide-border/30">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 flex-1">
          <div className="flex flex-col divide-y divide-border/30 md:border-r border-border/30">
            {capabilities.slice(0, 4).map(cap => (
              <MatrixRow key={cap.id} cap={cap} setLocation={setLocation} />
            ))}
          </div>
          <div className="flex flex-col divide-y divide-border/30">
            {capabilities.slice(4, 8).map(cap => (
              <MatrixRow key={cap.id} cap={cap} setLocation={setLocation} />
            ))}
          </div>
        </div>
      </div>
    </HermeticCard>
  );
}

function MatrixRow({
  cap,
  setLocation,
}: {
  cap: Capability;
  setLocation: (path: string) => void;
}) {
  const isLinked = Boolean(cap.href);
  const isMvp = cap.deploymentScope === "mvp";
  const scopeTone = cap.scopeTone ?? "primary";
  const scopePillClass =
    scopeTone === "critical" ? a.pillCritical : a.pillPrimary;
  const rowClassName = cn(
    "relative w-full flex items-center justify-between px-6 py-4 text-left transition-colors duration-200",
    "bg-transparent",
    isLinked ? "group cursor-pointer hover:bg-muted/34" : "cursor-default"
  );

  const content = (
    <>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center border",
            isMvp ? "border-primary/18" : "border-transparent"
          )}
          style={{
            backgroundColor: `${cap.color}12`,
            color: cap.color,
          }}
        >
          <cap.icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground dark:text-foreground/78">
              {cap.name}
            </span>
            {isMvp ? (
              <span
                className={cn(
                  scopePillClass,
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em]"
                )}
              >
                MVP
              </span>
            ) : null}
          </div>
          <span className="text-[11px] text-muted-foreground">
            {cap.description}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex flex-col items-end">
          <span className="text-sm font-medium tabular-nums text-foreground dark:text-foreground/78">
            {cap.metric}
          </span>
          <span className="text-[10px] text-muted-foreground">{cap.unit}</span>
        </div>

        <div
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            cap.status === "active"
              ? "bg-primary"
              : cap.status === "error"
                ? "bg-destructive"
                : "bg-muted-foreground/40"
          )}
        />

        {isLinked ? (
          <div className="inline-flex min-w-18 items-center justify-end gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/85">
            <span>{cap.external ? "External" : isMvp ? "Launch" : "Open"}</span>
            {cap.external ? (
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            )}
          </div>
        ) : null}
      </div>
    </>
  );

  if (!cap.href) {
    return <div className={rowClassName}>{content}</div>;
  }

  const href = cap.href;

  return (
    <button
      type="button"
      onClick={() =>
        cap.external
          ? window.open(href, "_blank", "noopener,noreferrer")
          : setLocation(href)
      }
      className={rowClassName}
    >
      {content}
    </button>
  );
}
