import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@hki/ui";
import { Activity, RefreshCw, Clock, Shield, Printer } from "lucide-react";
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
        "relative z-20 w-full overflow-visible rounded-2xl"
      )}
    >
      <div className="relative px-6 py-4 sm:px-8 sm:py-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          {/* Left — greeting */}
          <div className="min-w-0 max-w-2xl">
            <p className={a.sectionEyebrow}>Operations Snapshot</p>
            <h1 className="text-xl font-semibold leading-tight text-foreground dark:text-foreground/80 sm:text-2xl">
              {greeting},{" "}
              <span className="text-foreground dark:text-foreground/80">
                {user?.name?.split(" ")[0] || "Admin"}
              </span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground/70">{dateStr}</p>
            <p className="mt-2 text-sm text-muted-foreground/78">
              Platform health and knowledge operations at a glance.
            </p>
          </div>

          {/* Right — badges + actions */}
          <div className="flex flex-col items-start gap-2.5 print:hidden xl:items-end">
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

            <div className="flex items-center gap-2 xl:justify-end">
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
