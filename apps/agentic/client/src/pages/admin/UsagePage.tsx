/**
 * Usage & Billing Page — Token consumption and estimated spend.
 *
 * Shows aggregate token usage, model mix, and cost estimates.
 * Data comes from the analytics service via the governance.tokenUsage procedure.
 */

import { useState } from "react";
import { BarChart3, TrendingUp, Zap, Coins, Layers } from "lucide-react";
import { cn } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { a } from "./theme";
import { AdminPageHeader } from "./components/AdminPageHeader";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function UsagePage() {
  const [days, setDays] = useState(30);
  const usageQ = trpc.governance.tokenUsage.useQuery(
    { days },
    { refetchInterval: 60_000 }
  );

  const analytics = usageQ.data?.analytics;
  const costPerMillion = usageQ.data?.costPerMillion ?? 0;

  const totalInput = analytics?.total_input_tokens ?? 0;
  const totalOutput = analytics?.total_output_tokens ?? 0;
  const totalEmbedding = analytics?.total_embedding_tokens ?? 0;
  const grandTotal = totalInput + totalOutput + totalEmbedding;
  const estCost = (grandTotal / 1_000_000) * costPerMillion;

  const byModel: Record<string, number> = {};
  if (analytics?.by_model) {
    for (const [model, data] of Object.entries(
      analytics.by_model as Record<string, any>
    )) {
      byModel[model] = (data.input_tokens ?? 0) + (data.output_tokens ?? 0);
    }
  }

  const cardCls = cn(a.card, "p-5");
  const statCls =
    "text-2xl font-bold tracking-tight text-foreground tabular-nums";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Usage & Billing"
        description="Track aggregate token consumption, model mix, and estimated spend across the control plane."
        icon={BarChart3}
        action={
          <div className="flex items-center gap-2">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                  days === d
                    ? `${a.pillPrimary} shadow-sm`
                    : `${a.pillNeutral} hover:text-foreground`
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        }
        stats={[
          {
            label: "Billing window",
            value: `${days}d`,
            tone: "primary",
          },
          {
            label: "Total tokens",
            value: formatTokens(grandTotal),
            tone: grandTotal > 0 ? "positive" : "neutral",
          },
          {
            label: "Estimated spend",
            value: `$${estCost.toFixed(2)}`,
            tone: estCost > 0 ? "warning" : "neutral",
          },
        ]}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-3">
            <div
              className={cn(
                a.iconPrimary,
                "w-8 h-8 rounded-xl flex items-center justify-center"
              )}
            >
              <Zap className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              Total Tokens
            </span>
          </div>
          <p className={statCls}>{formatTokens(grandTotal)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Last {days} days
          </p>
        </div>

        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-3">
            <div
              className={cn(
                a.iconPrimary,
                "w-8 h-8 rounded-xl flex items-center justify-center"
              )}
            >
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              Input / Output
            </span>
          </div>
          <p className={statCls}>
            {formatTokens(totalInput)}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              / {formatTokens(totalOutput)}
            </span>
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Prompt / Completion tokens
          </p>
        </div>

        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-3">
            <div
              className={cn(
                a.iconNeutral,
                "w-8 h-8 rounded-xl flex items-center justify-center"
              )}
            >
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              Embedding Tokens
            </span>
          </div>
          <p className={statCls}>{formatTokens(totalEmbedding)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Knowledge base operations
          </p>
        </div>

        <div className={cardCls}>
          <div className="flex items-center gap-2 mb-3">
            <div
              className={cn(
                a.iconWarning,
                "w-8 h-8 rounded-xl flex items-center justify-center"
              )}
            >
              <Coins className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              Estimated Cost
            </span>
          </div>
          <p className={statCls}>${estCost.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            @ ${costPerMillion}/1M tokens
          </p>
        </div>
      </div>

      {/* Model breakdown */}
      {Object.keys(byModel).length > 0 && (
        <div className={cardCls}>
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Usage by Model
          </h3>
          <div className="space-y-3">
            {Object.entries(byModel)
              .sort(([, a], [, b]) => b - a)
              .map(([model, tokens]) => {
                const pct = grandTotal > 0 ? (tokens / grandTotal) * 100 : 0;
                return (
                  <div key={model} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground truncate">
                        {model}
                      </span>
                      <span className="text-muted-foreground tabular-nums ml-2 shrink-0">
                        {formatTokens(tokens)} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all duration-500"
                        style={{ width: `${Math.max(1, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
