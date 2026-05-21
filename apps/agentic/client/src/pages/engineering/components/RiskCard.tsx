import type { ComponentType } from "react";
import { cn } from "@hki/ui";
import { BeforeAfterFlow, type FlowRail } from "./BeforeAfterFlow";

export type RiskScenario = {
  id: string;
  title: string;
  /** One-line essence of the risk (replaces label + description + weakSignal sprawl). */
  summary: string;
  /** What it costs the enterprise. */
  enterpriseImpact: string;
  /** What HKI does about it. */
  hkiControl: string;
  /** Severity dot tone. Two values only. */
  severity: "high" | "critical";
  icon: ComponentType<{ className?: string }>;
  weakPath: readonly string[];
  hkiPath: readonly string[];
};

const SEVERITY_LABEL: Record<RiskScenario["severity"], string> = {
  high: "High",
  critical: "Critical",
};

export function RiskCard({
  scenario,
  index,
}: {
  scenario: RiskScenario;
  index: number;
}) {
  const Icon = scenario.icon;
  const rails: [FlowRail, FlowRail] = [
    {
      title: "Typical domain-aware path",
      tone: "risk",
      tag: "Boundary drift",
      steps: scenario.weakPath.map(label => ({ label })),
    },
    {
      title: "HKI path",
      tone: "safe",
      tag: "Scope preserved",
      steps: scenario.hkiPath.map(label => ({ label })),
    },
  ];

  return (
    <article
      id={`risk-${scenario.id}`}
      className="engineering-panel scroll-mt-28 p-5 sm:p-6"
    >
      <header className="flex items-start gap-4">
        <span
          className={cn(
            "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
            scenario.severity === "critical"
              ? "border-destructive/35 bg-destructive/8 text-destructive"
              : "border-destructive/25 bg-destructive/5 text-destructive"
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-[11px] font-bold tabular-nums text-muted-foreground">
              R{String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="text-lg font-bold tracking-tight text-foreground">
              {scenario.title}
            </h3>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]",
                scenario.severity === "critical"
                  ? "border-destructive/35 bg-destructive/10 text-destructive"
                  : "border-destructive/25 bg-destructive/6 text-destructive"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  scenario.severity === "critical"
                    ? "bg-destructive"
                    : "bg-destructive/60"
                )}
              />
              {SEVERITY_LABEL[scenario.severity]}
            </span>
          </div>
          <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
            {scenario.summary}
          </p>
        </div>
      </header>

      <div className="mt-5">
        <BeforeAfterFlow rails={rails} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-destructive/20 bg-destructive/8 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-destructive">
            What it costs
          </p>
          <p className="mt-1.5 text-sm leading-6 text-foreground/90">
            {scenario.enterpriseImpact}
          </p>
        </div>
        <div className="rounded-md border border-success/25 bg-success/8 p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-success">
            What HKI does
          </p>
          <p className="mt-1.5 text-sm leading-6 text-foreground/90">
            {scenario.hkiControl}
          </p>
        </div>
      </div>
    </article>
  );
}
