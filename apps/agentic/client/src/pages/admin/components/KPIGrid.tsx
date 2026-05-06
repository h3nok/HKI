import { cn, HkiCard } from "@hki/ui";
import {
  Layers,
  Users,
  Brain,
  Plus,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
} from "lucide-react";
import { a } from "../theme";

const KPI_ICON_MAP: Record<string, React.ElementType> = {
  "Avg Confidence": Brain,
  Conversations: MessageSquare,
  "Tool Calls": Plus,
  Guardrails: ShieldAlert,
  Domains: Layers,
  Operators: Users,
};

interface KPI {
  label: string;
  value: number | string;
  color: string;
  trend?: number;
  onClick?: () => void;
}

interface KPIGridProps {
  kpis: KPI[];
}

const ICON_MAP: Record<string, string> = {
  primary: a.iconPrimary,
  warning: a.iconWarning,
  critical: a.iconCritical,
  neutral: a.iconNeutral,
};

export function KPICardBox({ kpi }: { kpi: KPI; i?: number }) {
  const Icon = KPI_ICON_MAP[kpi.label] || Layers;

  return (
    <HkiCard
      key={kpi.label}
      elevation="raised"
      size="sm"
      interactive={!!kpi.onClick}
      onClick={kpi.onClick}
      className={cn(
        a.metricCard,
        "h-full rounded-xl px-4 py-4 flex flex-col justify-between gap-3 overflow-hidden"
      )}
    >
      <div className="flex items-center justify-between">
        <div
          className={cn(
            a.metricIcon,
            "w-8 h-8 rounded-[0.625rem] flex items-center justify-center",
            ICON_MAP[kpi.color] || a.iconNeutral
          )}
        >
          <Icon className="w-4 h-4" />
        </div>

        {kpi.trend != null && kpi.trend !== 0 && (
          <div
            className={cn(
              "flex items-center gap-0.5 text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded-full",
              kpi.trend > 0 ? a.pillPrimary : a.pillCritical
            )}
          >
            {kpi.trend > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {kpi.trend > 0 ? "+" : ""}
            {kpi.trend}%
          </div>
        )}
        {kpi.trend === 0 && (
          <div
            className={cn(
              a.pillNeutral,
              "flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full"
            )}
          >
            <Minus className="w-3 h-3" />
            0%
          </div>
        )}
      </div>
      <div>
        <p className={cn(a.metricValue, "mb-2 tabular-nums")}>{kpi.value}</p>
        <p className={a.metricLabel}>{kpi.label}</p>
      </div>
    </HkiCard>
  );
}

export function KPIGrid({ kpis }: KPIGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-6 gap-3">
      {kpis.map((kpi, i) => (
        <KPICardBox key={kpi.label} kpi={kpi} i={i} />
      ))}
    </div>
  );
}
