import { cn, HkiCard } from "@hki/ui";
import { Server, Cpu, Activity } from "lucide-react";
import { a } from "../theme";

export function OnPremNodeWidget() {
  return (
    <HkiCard
      elevation="raised"
      size="md"
      interactive={false}
      className={cn(
        a.card,
        "admin-on-prem-node-card relative overflow-hidden rounded-xl"
      )}
    >
      {/* Header with status pulse beacon */}
      <div
        className={cn(
          a.cardHeader,
          "px-5 pt-4 pb-3 flex items-center justify-between gap-3"
        )}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              a.metricIcon,
              a.iconPrimary,
              "flex size-8 items-center justify-center rounded-[0.625rem]"
            )}
          >
            <Server className="size-4" />
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
              Infrastructure
            </span>
            <h2 className="text-sm font-semibold text-foreground">
              On-Prem Secure Node
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/15">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <span className="font-mono text-[9px] font-bold text-emerald-500 uppercase tracking-wider">
            Healthy
          </span>
        </div>
      </div>

      {/* Body with specification grids & utilization meters */}
      <div className="px-5 pb-5 pt-3.5 flex flex-col gap-4">
        {/* Node & Isolation Details */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className={cn(
              a.inset,
              "flex flex-col gap-1 px-3 py-2.5 rounded-xl bg-background/20"
            )}
          >
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
              Host
            </span>
            <span className="text-xs font-mono font-semibold text-foreground">
              hki-node-prd-01
            </span>
          </div>
          <div
            className={cn(
              a.inset,
              "flex flex-col gap-1 px-3 py-2.5 rounded-xl bg-background/20"
            )}
          >
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">
              Isolation
            </span>
            <span className="text-xs font-mono font-semibold text-primary">
              Airgap-HSM
            </span>
          </div>
        </div>

        {/* Dynamic Resource Meters */}
        <div className="space-y-3.5 pt-1.5">
          {/* Agentic CPU */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="flex items-center gap-1.5 text-muted-foreground/90">
                <Cpu className="size-3.5 text-muted-foreground/70" /> Agentic
                CPU
              </span>
              <span className="text-foreground font-semibold">12.4%</span>
            </div>
            <div className="h-1.5 w-full bg-muted/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/80 rounded-full transition-all duration-500"
                style={{ width: "12.4%" }}
              />
            </div>
          </div>

          {/* HSM Memory */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="flex items-center gap-1.5 text-muted-foreground/90">
                <Activity className="size-3.5 text-muted-foreground/70" /> HSM
                Memory
              </span>
              <span className="text-foreground font-semibold">4.8 / 16 GB</span>
            </div>
            <div className="h-1.5 w-full bg-muted/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500/80 rounded-full transition-all duration-500"
                style={{ width: "30%" }}
              />
            </div>
          </div>
        </div>
      </div>
    </HkiCard>
  );
}
