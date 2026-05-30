import { Zap, Activity, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { skipToken } from "@tanstack/react-query";
import { cn } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { useKB } from "../../context/KnowledgeContext";
import { k } from "../../theme";
import { ScoreBar } from "./ChartPrimitives";
import OverviewSectionCard from "./OverviewSectionCard";

export default function LLMOperationsCard() {
  const { selectedStream } = useKB();
  const explicitStreamId =
    selectedStream && selectedStream !== "global" ? selectedStream : null;
  const obsQ = trpc.knowledge.observabilitySummary.useQuery(
    explicitStreamId ? { valueStreamId: explicitStreamId } : skipToken,
    {
      retry: false,
      staleTime: 30_000,
      refetchInterval: 60_000,
      enabled: Boolean(explicitStreamId),
    }
  );
  const obs = obsQ.data;

  if (!obs || obs.totalTraces === 0) return null;

  const errorRate = (obs.errorCount / obs.totalTraces) * 100;
  const errorTone =
    errorRate > 5 ? "critical" : errorRate > 0 ? "warning" : "positive";
  const p95DurationMs = (obs as any).p95DurationMs as number | undefined;
  const totalInputTokens = (obs as any).totalInputTokens as number | undefined;
  const totalOutputTokens = (obs as any).totalOutputTokens as
    | number
    | undefined;

  return (
    <OverviewSectionCard
      icon={Zap}
      title="LLM Operations"
      badge="Live"
      badgeTone="positive"
      bodyClassName="p-4 flex flex-col gap-3"
    >
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: "Traces",
            value: obs.totalTraces.toLocaleString(),
            icon: Activity,
            cls: "text-foreground",
          },
          {
            label: "Errors",
            value: obs.errorCount.toString(),
            icon: obs.errorCount > 0 ? AlertTriangle : CheckCircle,
            cls:
              obs.errorCount > 0
                ? k.statusCriticalText
                : "text-muted-foreground",
          },
          {
            label: "Avg latency",
            value: obs.avgDurationMs
              ? `${obs.avgDurationMs.toFixed(0)}ms`
              : "—",
            icon: Clock,
            cls: "text-muted-foreground",
          },
          {
            label: "p95 latency",
            value: p95DurationMs ? `${p95DurationMs.toFixed(0)}ms` : "—",
            icon: Clock,
            cls:
              (p95DurationMs ?? 0) > 5000
                ? k.statusWarningText
                : "text-muted-foreground",
          },
        ].map(s => (
          <div key={s.label} className="space-y-1">
            <p
              className={cn(
                "text-xl font-black tabular-nums leading-none",
                s.cls
              )}
            >
              {s.value}
            </p>
            <p className="text-[10px] text-muted-foreground/85">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Error rate bar */}
      <ScoreBar
        label="Error rate"
        value={Math.min(errorRate / 100, 1)}
        tone={errorTone}
        valueLabel={`${errorRate.toFixed(1)}%`}
      />

      {/* Token usage */}
      {((totalInputTokens ?? 0) > 0 || (totalOutputTokens ?? 0) > 0) && (
        <p className="text-[11px] text-muted-foreground/80">
          {(totalInputTokens ?? 0).toLocaleString()} input tokens
          {" · "}
          {(totalOutputTokens ?? 0).toLocaleString()} output tokens
        </p>
      )}
    </OverviewSectionCard>
  );
}
