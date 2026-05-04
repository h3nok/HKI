import {
  cn,
  COSTCO_BLUE,
  COSTCO_RED,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@hki/ui";
import { Sparkles, TrendingUp, AlertCircle } from "lucide-react";
import { AgenticReadinessMeter } from "./AgenticReadinessMeter";
import {
  healthColor,
  MATURITY_LEVELS,
  type MaturityResult,
  type MaturityLevel,
} from "./maturity-model";

const LEVEL_EXPLANATION: Record<MaturityLevel, string> = {
  seed: "This stream is just getting started. Add content and complete the setup steps to improve readiness.",
  sprout:
    "Early progress — content is being added. Keep ingesting sources and reviewing documents to climb higher.",
  growing:
    "Solid foundation. Review quality, fill coverage gaps, and validate answers to reach maturity.",
  mature:
    "Strong readiness. Content is reviewed, coverage is broad, and retrieval quality is high.",
  elite:
    "Top-tier agentic readiness. This stream is production-grade with comprehensive coverage and quality.",
};

const DIMENSION_TIPS: Record<string, string> = {
  Content:
    "Upload more documents or fill coverage gaps to strengthen this area.",
  Search:
    "Run test queries and validate retrieval quality to improve search scores.",
  Pipeline:
    "Ensure pipeline jobs complete without errors and reprocess any failures.",
  Journey: "Complete the remaining setup steps in the guided workflow.",
  Ops: "Improve uptime and reduce queue failures for better operational health.",
  Adoption:
    "Grow usage — more queries and users interacting with the knowledge base.",
};

export function ReadinessModule({
  maturity,
  stepsCompleted,
  totalSteps,
  launchStatus,
  chatHref,
}: {
  maturity: MaturityResult;
  stepsCompleted: number;
  totalSteps: number;
  launchStatus?: {
    label: string;
    tone: "brand" | "success" | "warning" | "danger" | "neutral";
    detail?: string;
  };
  chatHref?: string;
}) {
  const hasEvidence = maturity.hasEvidence;
  const hc = healthColor(maturity.overall);
  const scoreLabel = `${maturity.overall}/100`;
  const summaryLabel = hasEvidence
    ? `${MATURITY_LEVELS[maturity.level].label} stream`
    : "New stream";
  const supportCopy = hasEvidence
    ? `${summaryLabel}.`
    : "Add first content to score readiness.";
  const statusLabel = launchStatus?.label ?? hc.label;
  const statusTextClass = launchStatus
    ? launchStatus.tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : launchStatus.tone === "warning" || launchStatus.tone === "danger"
        ? "text-amber-600 dark:text-amber-400"
        : launchStatus.tone === "brand"
          ? "text-primary"
          : "text-muted-foreground"
    : hc.textCls;

  const dimensions = [
    { label: "Content", score: maturity.content },
    { label: "Search", score: maturity.search },
    { label: "Pipeline", score: maturity.pipeline },
    { label: "Journey", score: maturity.journey },
    { label: "Ops", score: maturity.ops },
    { label: "Adoption", score: maturity.adoption },
  ];

  const weakest = [...dimensions].sort((a, b) => a.score - b.score)[0];
  const strongest = [...dimensions].sort((a, b) => b.score - a.score)[0];

  const gauge = (
    <div className="relative isolate flex w-full flex-col items-center gap-1.25 rounded-3xl px-2.5 py-2 transition-colors hover:bg-muted/40">
      <AgenticReadinessMeter
        maturity={maturity}
        stepsCompleted={stepsCompleted}
        totalSteps={totalSteps}
        size="compact"
        showLabel={false}
        className="px-0 py-0"
      />

      <div className="flex flex-col items-center -mt-1">
        <p
          className="text-[1.72rem] font-black leading-none tracking-tighter"
          style={{ color: COSTCO_BLUE }}
        >
          {scoreLabel}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Agentic Readiness
        </p>
      </div>

      <div className="flex items-center justify-center">
        <span
          className={cn(
            "inline-flex items-center rounded-full border border-border/40 bg-background/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
            statusTextClass
          )}
        >
          {statusLabel}
        </span>
      </div>

      <p className="max-w-[18ch] text-center text-[10px] leading-4 text-muted-foreground">
        {supportCopy}
      </p>
    </div>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full cursor-pointer rounded-3xl transition-shadow hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {gauge}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-80 rounded-2xl p-0 overflow-hidden"
      >
        {/* Header */}
        <div
          className="px-4 py-3 text-white"
          style={{
            background: `linear-gradient(135deg, ${COSTCO_BLUE}, ${COSTCO_BLUE}dd)`,
          }}
        >
          <p className="text-sm font-bold">
            {MATURITY_LEVELS[maturity.level].label} Stream — {maturity.overall}
            /100
          </p>
          <p className="text-[11px] leading-relaxed opacity-90 mt-0.5">
            {LEVEL_EXPLANATION[maturity.level]}
          </p>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Dimension bars */}
          {hasEvidence && (
            <div className="space-y-1.5">
              {dimensions.map(d => (
                <div key={d.label} className="flex items-center gap-2">
                  <span className="text-[11px] w-16 shrink-0 text-muted-foreground font-medium">
                    {d.label}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(d.score, 100)}%`,
                        backgroundColor:
                          d.score >= 70
                            ? COSTCO_BLUE
                            : d.score >= 40
                              ? "#f59e0b"
                              : COSTCO_RED,
                      }}
                    />
                  </div>
                  <span className="text-[10px] w-7 text-right tabular-nums text-muted-foreground">
                    {d.score}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Insight cards */}
          {hasEvidence && (
            <div className="grid grid-cols-2 gap-2">
              {strongest && strongest.score > 0 && (
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-2">
                  <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      Strongest
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-foreground mt-0.5">
                    {strongest.label}
                  </p>
                </div>
              )}
              {weakest && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 px-2.5 py-2">
                  <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="w-3 h-3" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      Focus area
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-foreground mt-0.5">
                    {weakest.label}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Recommendation */}
          {hasEvidence && weakest && DIMENSION_TIPS[weakest.label] && (
            <p className="text-[11px] leading-relaxed text-muted-foreground border-l-2 border-primary/30 pl-2.5">
              {DIMENSION_TIPS[weakest.label]}
            </p>
          )}

          {/* Steps + separator */}
          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <span className="text-[11px] text-muted-foreground">
              {stepsCompleted}/{totalSteps} steps completed
            </span>
            {launchStatus?.detail && (
              <span className={cn("text-[10px] font-medium", statusTextClass)}>
                {launchStatus.detail}
              </span>
            )}
          </div>

          {/* Open Agent CTA */}
          {chatHref && (
            <a
              href={chatHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center justify-center gap-1.5 w-full rounded-lg px-3 py-2.5 text-xs font-semibold text-white transition-colors",
                "bg-primary hover:bg-primary/90"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Open Agent
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
