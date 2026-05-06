/**
 * ServiceHealthIndicator — compact top-bar status dots
 *
 * Shows colored dots for knowledge-api, pipeline, orchestrator, and related services.
 * Polls every 30s via the serviceHealth tRPC procedure.
 * Hovering reveals a stable hover card with service names and latency.
 */

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { trpc } from "@/lib/trpc";
import { cn } from "@hki/ui";

const SERVICE_LABELS: Record<string, string> = {
  "knowledge-api": "Knowledge API",
  pipeline: "Ingestion Pipeline",
  orchestrator: "Orchestrator",
  "llm-gateway": "LLM Gateway",
  "hvsi-audit": "HVSI Audit",
};

type ServiceEntry = {
  name: string;
  ok: boolean;
  latencyMs: number;
};

export default function ServiceHealthIndicator() {
  const healthQ = trpc.knowledge.serviceHealth.useQuery(undefined, {
    retry: false,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const services: ServiceEntry[] = healthQ.data?.services ?? [];
  const allOnline =
    services.length > 0 && services.every(service => service.ok);
  const anyOffline = services.some(service => !service.ok);
  const isChecking = healthQ.isLoading || healthQ.isFetching;

  return (
    <HoverCard openDelay={120} closeDelay={280}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded-lg px-2 py-1 transition-colors",
            "hover:bg-black/5 dark:hover:bg-white/5"
          )}
          aria-label="Infrastructure status"
        >
          {services.length === 0 ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-muted-foreground/40 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-muted-foreground/40" />
            </span>
          ) : (
            services.map(service => (
              <span key={service.name} className="relative flex h-2 w-2">
                {service.ok && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full kb-duotone-ping opacity-40" />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-2 w-2 rounded-full",
                    service.ok ? "bg-primary" : "bg-red-500"
                  )}
                />
              </span>
            ))
          )}

          <span
            className={cn(
              "ml-0.5 hidden text-xs font-medium sm:inline",
              isChecking
                ? "text-muted-foreground/60"
                : allOnline
                  ? "text-primary"
                  : anyOffline
                    ? "text-red-500 dark:text-red-400"
                    : "text-muted-foreground/60"
            )}
          >
            {isChecking
              ? "…"
              : allOnline
                ? "All systems go"
                : anyOffline
                  ? "Degraded"
                  : "—"}
          </span>
        </button>
      </HoverCardTrigger>

      {services.length > 0 && (
        <HoverCardContent
          side="bottom"
          align="end"
          sideOffset={8}
          className={cn(
            "z-1300 w-52 rounded-xl border border-border/30 bg-card px-1 py-2 text-left font-normal normal-case tracking-normal",
            "text-foreground shadow-lg shadow-black/8 dark:shadow-black/30"
          )}
        >
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
            Infrastructure
          </p>
          {services.map(service => (
            <div
              key={service.name}
              className="flex items-center justify-between rounded-lg px-3 py-1 hover:bg-black/3 dark:hover:bg-white/3"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-1.5 w-1.5 shrink-0 rounded-full",
                    service.ok ? "bg-primary" : "bg-red-500"
                  )}
                />
                <span className="text-xs text-foreground dark:text-muted-foreground">
                  {SERVICE_LABELS[service.name] ?? service.name}
                </span>
              </div>
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  service.ok
                    ? "text-muted-foreground/60"
                    : "text-red-500 dark:text-red-400"
                )}
              >
                {service.ok ? `${service.latencyMs}ms` : "offline"}
              </span>
            </div>
          ))}
        </HoverCardContent>
      )}
    </HoverCard>
  );
}
