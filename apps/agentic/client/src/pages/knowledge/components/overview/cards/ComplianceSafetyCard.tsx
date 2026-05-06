import { ShieldCheck } from "lucide-react";
import {
  SurfaceCard,
  IconBadge,
  InlineMetric,
  CardFooter,
} from "../OverviewPrimitives";
import type { ComplianceSafetyCardModel } from "../OverviewPage";
import type { ChipTone } from "../OverviewPrimitives";

export function ComplianceSafetyCard({
  data,
}: {
  data: ComplianceSafetyCardModel;
}) {
  const tone: ChipTone =
    data.serviceCount > data.upCount || (data.llmErrorRate ?? 0) > 5
      ? "warning"
      : data.attested
        ? "success"
        : "neutral";

  const badgeLabel =
    data.serviceCount > data.upCount
      ? "Needs attention"
      : data.attested
        ? "Healthy"
        : "Pending";

  const healthLabel =
    data.llmErrorRate === null
      ? "—"
      : data.llmErrorRate > 5
        ? `${data.llmErrorRate.toFixed(1)}% err`
        : "OK";

  return (
    <SurfaceCard
      variant={
        tone === "warning"
          ? "warning"
          : tone === "success"
            ? "success"
            : "default"
      }
      className="flex h-full flex-col gap-4 px-5 py-5"
    >
      {/* ── Single-row header: icon · title · stats · badge ── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <IconBadge
          icon={ShieldCheck}
          tone={tone}
          className="h-9 w-9 shrink-0"
        />
        <h3 className="text-sm font-semibold tracking-tight text-foreground whitespace-nowrap">
          Compliance & Safety
        </h3>

        <span className="hidden sm:block h-5 w-px bg-border/50" />

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {data.serviceCount > 0 && (
            <span className="inline-flex items-baseline gap-1">
              <span className="text-base font-black tabular-nums tracking-tight text-primary">
                {data.upCount}/{data.serviceCount}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                services
              </span>
            </span>
          )}
          <span className="inline-flex items-baseline gap-1">
            <span className="text-base font-black tabular-nums tracking-tight text-foreground">
              {data.attested ? "Yes" : "No"}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              attested
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-base font-black tabular-nums tracking-tight text-foreground">
              {data.teamConfirmedCount}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              team
            </span>
          </span>
          <span className="inline-flex items-baseline gap-1">
            <span className="text-base font-black tabular-nums tracking-tight text-foreground">
              {healthLabel}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              AI health
            </span>
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <InlineMetric
          label="Your attestation"
          value={data.attested ? "Confirmed" : "Pending"}
          tone={data.attested ? "success" : "warning"}
        />
        <InlineMetric
          label="Team confirmations"
          value={data.teamConfirmedCount}
          tone={data.teamConfirmedCount > 0 ? "brand" : "neutral"}
        />
        <InlineMetric
          label="AI model health"
          value={
            data.llmErrorRate === null
              ? "No activity yet"
              : data.llmErrorRate > 5
                ? `${data.llmErrorRate.toFixed(1)}% errors`
                : "Healthy"
          }
          tone={
            data.llmErrorRate === null
              ? "neutral"
              : data.llmErrorRate > 5
                ? "warning"
                : "success"
          }
          className="md:col-span-2"
        />
      </div>

      <CardFooter action={data.action} />
    </SurfaceCard>
  );
}
