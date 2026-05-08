import { cn } from "@hki/ui";

export type AutonomyStage = {
  label: string;
  capability: string;
  isolationNeed: string;
};

export const AUTONOMY_STAGES: readonly AutonomyStage[] = [
  {
    label: "Assist",
    capability: "Answer and cite",
    isolationNeed: "Retrieval and citation scope must be exact.",
  },
  {
    label: "Act",
    capability: "Call tools",
    isolationNeed: "Tool arguments cannot broaden the active domain.",
  },
  {
    label: "Coordinate",
    capability: "Use memory and jobs",
    isolationNeed: "Async jobs, traces, and memory must preserve labels.",
  },
  {
    label: "Operate",
    capability: "Run workflows",
    isolationNeed: "Publication is the only cross-domain bridge.",
  },
] as const;

const STAGE_RISK: readonly {
  badge: string;
  dot: string;
  bar: string;
  row: string;
}[] = [
  {
    badge: "bg-success/15 text-success",
    dot: "bg-success",
    bar: "bg-success/40",
    row: "",
  },
  {
    badge: "bg-warning/15 text-warning",
    dot: "bg-warning",
    bar: "bg-warning/40",
    row: "",
  },
  {
    badge: "bg-orange-500/15 text-orange-500",
    dot: "bg-orange-500",
    bar: "bg-orange-500/40",
    row: "",
  },
  {
    badge: "bg-destructive/15 text-destructive",
    dot: "bg-destructive",
    bar: "bg-destructive/40",
    row: "bg-destructive/2",
  },
];

export function AutonomyLadder({
  stages = AUTONOMY_STAGES,
  currentStage,
  className,
}: {
  stages?: readonly AutonomyStage[];
  currentStage?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border/60",
        className
      )}
      role="table"
      aria-label="Autonomy ladder: stage, capability, isolation requirement"
    >
      <div
        role="row"
        className="grid grid-cols-[140px_minmax(0,1fr)_minmax(0,1.6fr)] border-b border-border/60 bg-muted/40 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
      >
        <span role="columnheader">Stage</span>
        <span role="columnheader">Capability</span>
        <span role="columnheader">Isolation requirement</span>
      </div>
      {stages.map((stage, i) => {
        const active = currentStage === i;
        const risk = STAGE_RISK[i] ?? STAGE_RISK[STAGE_RISK.length - 1];
        return (
          <div
            key={stage.label}
            role="row"
            className={cn(
              "relative grid grid-cols-[140px_minmax(0,1fr)_minmax(0,1.6fr)] items-start gap-x-4 border-b border-border/40 py-3 pr-4 pl-7 last:border-b-0",
              active && "bg-primary/6",
              !active && risk.row
            )}
          >
            {/* Escalating risk bar on the left edge */}
            <span
              aria-hidden
              className={cn("absolute inset-y-0 left-0 w-1", risk.bar)}
            />
            <span
              role="cell"
              className="flex items-center gap-2 text-sm font-semibold text-foreground"
            >
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                  active ? "bg-primary text-primary-foreground" : risk.badge
                )}
              >
                {i + 1}
              </span>
              {stage.label}
            </span>
            <span role="cell" className="text-sm leading-6 text-foreground/90">
              {stage.capability}
            </span>
            <span
              role="cell"
              className="text-sm leading-6 text-muted-foreground"
            >
              {stage.isolationNeed}
            </span>
          </div>
        );
      })}
    </div>
  );
}
