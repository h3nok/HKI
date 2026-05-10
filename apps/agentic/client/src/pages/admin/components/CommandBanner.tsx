import { useAuth } from "@/_core/hooks/useAuth";
import { AppAiText } from "@/components/ui/app-shell-primitives";
import { cn } from "@hki/ui";
import {
  Activity,
  Clock,
  Gauge,
  Printer,
  RefreshCw,
  Server,
  Shield,
} from "lucide-react";
import { useState, useEffect } from "react";
import { a } from "../theme";

interface CommandBannerProps {
  greeting: string;
  envMeta: { label: string; dot: string };
  allOk: boolean;
  services: Array<{ label: string; ok: boolean; ms?: number }>;
  onRefresh: () => void;
}

export function CommandBanner({
  greeting,
  envMeta,
  allOk,
  services,
  onRefresh,
}: CommandBannerProps) {
  const { user } = useAuth();
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const healthyCount = services.filter(s => s.ok).length;
  const degradedServices = services.filter(s => !s.ok);
  const degradedSummary = degradedServices.map(s => s.label).join(", ");
  const serviceCount = Math.max(services.length, 1);
  const healthScore = Math.round((healthyCount / serviceCount) * 100);
  const latencySamples = services
    .map(service => service.ms)
    .filter((ms): ms is number => Number.isFinite(ms));
  const averageLatency =
    latencySamples.length > 0
      ? Math.round(
          latencySamples.reduce((total, ms) => total + ms, 0) /
            latencySamples.length
        )
      : null;

  const [lastUpdated, setLastUpdated] = useState(new Date());
  useEffect(() => {
    setLastUpdated(new Date());
  }, [services, allOk]);

  const timeAgo = () => {
    const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 120) return "1 min ago";
    return `${Math.floor(diff / 60)} min ago`;
  };

  return (
    <div
      className={cn(
        a.hero,
        "admin-command-banner relative z-20 w-full overflow-hidden rounded-xl"
      )}
      onPointerMove={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty(
          "--admin-pointer-x",
          `${event.clientX - rect.left}px`
        );
        event.currentTarget.style.setProperty(
          "--admin-pointer-y",
          `${event.clientY - rect.top}px`
        );
      }}
    >
      <div className="admin-command-banner__content relative px-6 py-4 sm:px-8 sm:py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch xl:justify-between">
          {/* Left — greeting */}
          <div className="min-w-0 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className={a.sectionEyebrow}>Operations Snapshot</p>
              <span
                className={cn(
                  allOk ? a.pillPrimary : a.pillNeutral,
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                )}
              >
                <Activity className="size-3" />
                {allOk ? "Live control plane" : "Operator attention"}
              </span>
            </div>
            <h1 className="text-xl font-semibold leading-tight text-foreground dark:text-foreground/80 sm:text-2xl">
              {greeting},{" "}
              <AppAiText>{user?.name?.split(" ")[0] || "Admin"}</AppAiText>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground/70">{dateStr}</p>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground/78">
              Service readiness, agent activity, and knowledge-plane health in
              one operator surface.
            </p>

            <div className="admin-command-banner__service-rail mt-4 hidden flex-wrap gap-2 md:flex">
              {services.map(service => (
                <span
                  key={service.label}
                  className="admin-command-banner__service-chip"
                  data-ok={service.ok}
                  title={
                    service.ms != null
                      ? `${service.label}: ${service.ms}ms`
                      : service.label
                  }
                >
                  <span className="admin-command-banner__service-dot" />
                  <span>{service.label}</span>
                  {service.ms != null ? (
                    <span className="admin-command-banner__service-latency">
                      {service.ms}ms
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>

          {/* Right — badges + actions */}
          <div
            className={cn(
              a.inset,
              "admin-command-banner__operator-panel flex w-full max-w-sm flex-col gap-3 rounded-xl p-3 print:hidden xl:w-88 xl:self-stretch"
            )}
          >
            <div className="flex items-center justify-between gap-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="size-3.5" />
                Control plane
              </span>
              <span className="font-mono tabular-nums">{healthScore}%</span>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full min-w-1.5 rounded-full bg-primary transition-[width]"
                style={{ width: `${healthScore}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <span className="flex min-w-0 items-center justify-center gap-1 rounded-lg bg-foreground/4 px-1.5 py-1.5 text-[10px] font-medium text-muted-foreground">
                <Server className="size-3.5" />
                <strong className="text-[11px] text-foreground">
                  {healthyCount}/{services.length || 0}
                </strong>
                online
              </span>
              <span className="flex min-w-0 items-center justify-center gap-1 rounded-lg bg-foreground/4 px-1.5 py-1.5 text-[10px] font-medium text-muted-foreground">
                <Clock className="size-3.5" />
                <strong className="text-[11px] text-foreground">
                  {averageLatency != null ? `${averageLatency}ms` : "n/a"}
                </strong>
                avg
              </span>
              <span className="flex min-w-0 items-center justify-center gap-1 rounded-lg bg-foreground/4 px-1.5 py-1.5 text-[10px] font-medium text-muted-foreground">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-current"
                />
                <strong className="text-[11px] text-foreground">
                  {envMeta.label}
                </strong>
                runtime
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              {/* Health summary */}
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium",
                  allOk ? a.pillPositive : a.pillWarning
                )}
                title={
                  !allOk && degradedSummary
                    ? `Degraded: ${degradedSummary}`
                    : undefined
                }
              >
                {allOk ? (
                  <Shield className="w-3 h-3" />
                ) : (
                  <Activity className="w-3 h-3 animate-pulse" />
                )}
                {allOk
                  ? `${healthyCount}/${services.length} services healthy`
                  : `${degradedServices.length} service${degradedServices.length > 1 ? "s" : ""} degraded`}
              </div>

              {/* Services count badge */}
              <div
                className={cn(
                  a.inset,
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-muted-foreground"
                )}
              >
                <Clock className="w-3 h-3 text-muted-foreground/60" />
                <span className="font-mono tabular-nums">{timeAgo()}</span>
              </div>

              {/* Env badge */}
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                  envMeta.label === "DEV" && a.pillPrimary,
                  envMeta.label === "PROD" && a.pillCritical,
                  envMeta.label === "STG" && a.pillWarning
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {envMeta.label}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleExport}
                className={cn(
                  a.inset,
                  "hidden md:flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:text-foreground"
                )}
                title="Print / Export to PDF"
              >
                <Printer className="w-3 h-3" />
                Export
              </button>

              <button
                onClick={onRefresh}
                className={cn(
                  a.inset,
                  "inline-flex items-center justify-center rounded-xl p-1.5 text-muted-foreground transition-colors hover:border-primary/20 hover:text-foreground active:scale-95"
                )}
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function handleExport() {
  window.print();
}
