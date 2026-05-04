import { Boxes, FileText, Network, Zap } from "lucide-react";
import { cn } from "@hki/ui";
import { type KnowledgeTab } from "../../types";
import { k } from "../../theme";

export function OverviewMetricsStrip({
  docCount,
  chunkCount,
  entityCount,
  jobCount,
  services,
  onNavigate,
}: {
  docCount: number;
  chunkCount: number;
  entityCount: number;
  jobCount: number;
  services: any[];
  onNavigate: (tab: KnowledgeTab, section?: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,4fr)_minmax(0,3fr)] gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(
          [
            {
              icon: FileText,
              value: docCount,
              label: "Documents",
              color: "text-primary",
              bg: k.duoToneFill,
              tab: "library" as KnowledgeTab,
            },
            {
              icon: Boxes,
              value: chunkCount,
              label: "Passages",
              color: k.statusNeutralText,
              bg: k.statusNeutralSurface,
              tab: "library" as KnowledgeTab,
            },
            {
              icon: Network,
              value: entityCount,
              label: "Key Topics",
              color: k.statusWarningText,
              bg: k.statusWarningSurface,
              tab: "library" as KnowledgeTab,
            },
            {
              icon: Zap,
              value: jobCount,
              label: "Jobs",
              color: "text-primary",
              bg: k.duoToneFill,
              tab: "pipelines" as KnowledgeTab,
            },
          ] as const
        ).map(stat => (
          <button
            key={stat.label}
            onClick={() => onNavigate(stat.tab)}
            className={cn(
              k.card,
              "group relative flex items-center gap-2.5 px-3 py-3.5 min-h-24 text-left",
              "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]",
              stat.value > 0 && k.glow
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                stat.bg,
                "group-hover:scale-110 transition-transform duration-200"
              )}
            >
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold tabular-nums leading-none tracking-tight text-foreground">
                {stat.value.toLocaleString()}
              </p>
              <p className={cn(k.muted, "mt-0.5")}>{stat.label}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {services.map((svc: any) => (
          <div
            key={svc.name}
            className={cn(
              k.card,
              "flex items-center gap-2.5 px-3 py-3.5 min-h-24",
              svc.ok
                ? `${k.statusPositiveSurface} border-primary/15`
                : "border-destructive/20 bg-destructive/2"
            )}
          >
            <div className="relative">
              <div
                className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0",
                  svc.ok ? k.statusPositiveDot : k.statusCriticalDot
                )}
              />
              {svc.ok && (
                <div
                  className={cn(
                    "absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping opacity-30",
                    k.statusPositiveDot
                  )}
                />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground capitalize truncate">
                {svc.name.replace(/-/g, " ")}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground/70">
                {svc.ok ? `${svc.latencyMs}ms` : "Unreachable"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
