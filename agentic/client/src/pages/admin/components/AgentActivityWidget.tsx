import { motion } from "framer-motion";
import { cn, textColor, HkiCard } from "@hki/ui";
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
}

export function AgentActivityWidget({
  traces,
  isLoading,
  onViewAll,
}: AgentActivityWidgetProps) {
  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.45 }}
    >
      <HkiCard
        elevation="raised"
        size="md"
        interactive={false}
        className={cn(a.card, "h-full max-h-[28rem] overflow-hidden flex flex-col relative")}
      >
        <div
          className={cn(
            a.cardHeader,
            "px-5 pt-4 pb-3 flex items-center justify-between"
          )}
        >
          <h2 className="text-sm font-medium text-foreground dark:text-foreground/78">
            Recent Activity
          </h2>
          <button
            onClick={onViewAll}
            className={cn(
              a.toolbarButton,
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            )}
          >
            All Traces <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <div className="flex-1 min-h-0 px-3 pb-3">
          {isLoading ? (
            <div
              className={cn(
                a.inset,
                "flex min-h-55 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/78"
              )}
            >
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : traces.length === 0 ? (
            <div
              className={cn(
                a.inset,
                "relative flex min-h-55 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-border/70 bg-background/78 px-6 text-center"
              )}
            >
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-primary/12" />
              <div className="pointer-events-none absolute inset-x-10 bottom-4 h-12 rounded-full bg-primary/8 blur-2xl" />
              <div
                className={cn(
                  a.iconNeutral,
                  "relative z-10 flex h-11 w-11 items-center justify-center rounded-xl"
                )}
              >
                <Brain className="h-5 w-5" />
              </div>
              <div className="relative z-10 space-y-1">
                <p className="text-sm font-semibold text-foreground/88">
                  No live activity yet
                </p>
                <p className="mx-auto max-w-72 text-xs leading-relaxed text-muted-foreground/78">
                  Start a conversation to populate this trace feed with
                  confidence, latency, and tool usage.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-0 space-y-1 overflow-y-auto scrollbar-thin pr-1">
              {traces.map((trace, i) => (
                <motion.div
                  key={trace.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className={cn(
                    a.previewRow,
                    "flex items-center gap-3 px-4 py-3.5 rounded-xl hover:border-primary/20 hover:shadow-sm transition-all duration-200 group"
                  )}
                >
                  <div
                    className={cn(
                      a.iconNeutral,
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0"
                    )}
                  >
                    <MessageSquare
                      className={cn(
                        "w-3.5 h-3.5 transition-colors",
                        textColor.secondary
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground dark:text-foreground/78 truncate">
                      {trace.query}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {trace.tools && trace.tools.length > 0 && (
                        <span className={cn("text-[10px]", textColor.muted)}>
                          {trace.tools.length} tool
                          {trace.tools.length > 1 ? "s" : ""}
                        </span>
                      )}
                      {trace.latency && trace.latency > 0 && (
                        <span
                          className={cn(
                            "text-[10px] font-mono tabular-nums",
                            textColor.muted
                          )}
                        >
                          {trace.latency.toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-medium tabular-nums px-2 py-0.5 rounded-md shrink-0 border",
                      trace.confidence >= 0.8
                        ? a.pillPositive
                        : trace.confidence >= 0.5
                          ? a.pillWarning
                          : a.pillCritical
                    )}
                  >
                    {Math.round(trace.confidence * 100)}%
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </HkiCard>
    </motion.div>
  );
}
