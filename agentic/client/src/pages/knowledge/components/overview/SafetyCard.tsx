import { ShieldCheck } from "lucide-react";
import { skipToken } from "@tanstack/react-query";
import { cn } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { k } from "../../theme";
import StatusCard, { type CardStatus } from "./StatusCard";

export default function SafetyCard({
  selectedStream,
  onNavigate,
}: {
  selectedStream?: string;
  onNavigate: () => void;
}) {
  const explicitStreamId =
    selectedStream && selectedStream !== "global" ? selectedStream : null;
  const healthQ = trpc.knowledge.serviceHealth.useQuery(undefined, {
    retry: false,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const obsQ = trpc.knowledge.observabilitySummary.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const attestQ = trpc.knowledge.getAttestation.useQuery(
    explicitStreamId ? { valueStreamId: explicitStreamId } : skipToken,
    { retry: false, enabled: Boolean(explicitStreamId) }
  );
  const teamAttestationsQ = trpc.knowledge.listAttestations.useQuery(
    explicitStreamId ? { valueStreamId: explicitStreamId } : skipToken,
    { retry: false, staleTime: 30_000, enabled: Boolean(explicitStreamId) }
  );

  const services: any[] = healthQ.data?.services ?? [];
  const obs = obsQ.data;
  const attested = attestQ.data?.attested ?? false;
  const teamConfirmedCount = teamAttestationsQ.data?.length ?? 0;
  const llmErrorRate =
    obs && obs.totalTraces > 0 ? (obs.errorCount / obs.totalTraces) * 100 : 0;
  const serviceDownCount = services.filter(s => !s.ok).length;
  const upCount = services.filter(s => s.ok).length;

  const status: CardStatus =
    serviceDownCount > 0
      ? "error"
      : llmErrorRate > 5
        ? "warn"
        : !attested
          ? "warn"
          : "ok";

  const primary =
    services.length > 0
      ? `${upCount} / ${services.length}`
      : attested
        ? "✓"
        : "—";

  const primaryLabel =
    services.length > 0
      ? "services healthy"
      : attested
        ? "attestation confirmed"
        : "attestation pending";

  const secondary = [
    llmErrorRate > 0 && `${llmErrorRate.toFixed(1)}% LLM errors`,
    teamConfirmedCount > 0 &&
      `${teamConfirmedCount} team attestation${teamConfirmedCount !== 1 ? "s" : ""}`,
    !attested && "you have not attested",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <StatusCard
      icon={ShieldCheck}
      title="Safety Checks"
      status={status}
      primaryValue={primary}
      primaryLabel={primaryLabel}
      secondaryText={secondary || undefined}
      actionLabel="View compliance"
      onAction={onNavigate}
    >
      {services.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {services.map((s: any) => (
            <div
              key={s.name}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium border",
                s.ok ? k.statusPositiveBadge : k.statusCriticalBadge
              )}
            >
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  s.ok ? k.statusPositiveDot : k.statusCriticalDot
                )}
              />
              <span className="capitalize">{s.name.replace(/-/g, " ")}</span>
              <span
                className={cn(
                  "tabular-nums",
                  s.ok ? "text-muted-foreground/70" : ""
                )}
              >
                {s.ok ? `${s.latencyMs}ms` : "down"}
              </span>
            </div>
          ))}
        </div>
      )}
    </StatusCard>
  );
}
