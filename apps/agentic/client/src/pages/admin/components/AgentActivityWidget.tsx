import { cn, HermeticCard } from "@hki/ui";
import { Brain, ArrowUpRight, Loader2, MessageSquare } from "lucide-react";
import { a } from "../theme";

interface Trace {
  id: string;
  query: string;
  confidence: number;
  latency?: number;
  tools?: { length: number };
}

interface AgentActivityWidgetProps {
  traces: Trace[];
  isLoading: boolean;
  onViewAll: () => void;
  className?: string;
}

export function AgentActivityWidget({
  traces,
  isLoading,
  onViewAll,
  className,
}: AgentActivityWidgetProps) {
  return (
    <HermeticCard
      elevation="raised"
      size="md"
      interactive={false}
      className={cn(
        a.card,
        "min-h-120 overflow-hidden flex flex-col rounded-xl",
        className
      )}
    >
      <div
        className={cn(
          a.cardHeader,
          "px-5 pt-4 pb-3 flex items-start justify-between gap-3"
        )}
      >
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
            Trace Stream
          </span>
          <p className="mt-1 text-sm font-semibold text-foreground">
            Agent execution path
          </p>
        </div>
        <button
          onClick={onViewAll}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors duration-150"
        >
          All traces <ArrowUpRight className="size-3" />
        </button>
      </div>

      <div className="flex-1 min-h-0 px-2 pb-2">
        {isLoading ? (
          <div className="flex min-h-56 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : traces.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
              <Brain className="size-4" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              No live activity yet
            </p>
            <p className="mx-auto max-w-72 text-xs leading-relaxed text-muted-foreground">
              Start a conversation to populate this feed.
            </p>
          </div>
        ) : (
          <div className="h-full min-h-0 space-y-0.5 overflow-y-auto pr-1">
            {traces.map(trace => (
              <div
                key={trace.id}
                className="group/row flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 hover:bg-muted/50"
              >
                <div className="size-7 rounded-lg bg-muted/70 flex items-center justify-center shrink-0">
                  <MessageSquare className="size-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">
                    {trace.query}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {trace.tools && trace.tools.length > 0 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {trace.tools.length} tool
                        {trace.tools.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {trace.latency && trace.latency > 0 && (
                      <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                        {trace.latency.toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded-md shrink-0",
                    trace.confidence >= 0.8
                      ? "bg-success/12 text-success"
                      : trace.confidence >= 0.5
                        ? "bg-warning/12 text-warning"
                        : "bg-destructive/12 text-destructive"
                  )}
                >
                  {Math.round(trace.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </HermeticCard>
  );
}
