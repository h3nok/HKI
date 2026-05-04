import { type HTMLAttributes, type ReactNode } from "react";
import { type LucideIcon, ArrowRight } from "lucide-react";
import { Badge, cn } from "@hki/ui";
import { SegBar, type Tone } from "./ChartPrimitives";
import { k } from "../../theme";

export type SurfaceVariant =
  | "default"
  | "raised"
  | "tinted"
  | "warning"
  | "danger"
  | "success"
  | "subtle";

export type ChipTone = "brand" | "success" | "warning" | "danger" | "neutral";

const SURFACE_EDGE = [
  "relative overflow-hidden",
  "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px",
  "before:bg-white/45 dark:before:bg-white/5",
].join(" ");

const SURFACE_VARIANTS: Record<SurfaceVariant, string> = {
  default: cn(
    k.card,
    SURFACE_EDGE,
    "border border-black/8 shadow-[0_1px_0_rgba(255,255,255,0.55),0_16px_28px_-24px_rgba(15,23,42,0.22)] dark:border-white/8 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_20px_36px_-28px_rgba(0,0,0,0.62),0_8px_18px_-14px_rgba(0,0,0,0.44)]"
  ),
  raised: cn(
    k.surfaceRaised,
    SURFACE_EDGE,
    "transition-[box-shadow,border-color,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/18 hover:shadow-[0_1px_0_rgba(255,255,255,0.55),0_22px_40px_-24px_rgba(15,23,42,0.28)] dark:hover:border-white/14 dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_28px_48px_-28px_rgba(0,0,0,0.72),0_12px_24px_-14px_rgba(0,0,0,0.54)]"
  ),
  tinted: cn(k.surfaceTinted, SURFACE_EDGE, "overflow-hidden"),
  warning: cn(
    k.surfaceRaised,
    "border-secondary/16 shadow-[0_10px_18px_-18px_rgba(220,38,38,0.14)]"
  ),
  danger: cn(
    k.surfaceRaised,
    "border-secondary/24 shadow-[0_10px_20px_-18px_rgba(220,38,38,0.22)]"
  ),
  success: cn(
    k.surfaceRaised,
    "border-primary/16 shadow-[0_10px_22px_-20px_rgba(0,93,170,0.26)]"
  ),
  subtle: cn(
    k.sectionSurface,
    SURFACE_EDGE,
    "border border-black/6 shadow-[0_1px_0_rgba(255,255,255,0.4),0_12px_22px_-24px_rgba(15,23,42,0.16)] dark:border-white/6 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_16px_26px_-24px_rgba(0,0,0,0.5)]"
  ),
};

const CHIP_TONES: Record<ChipTone, string> = {
  brand: "border border-primary/18 bg-primary/12 text-primary",
  success: "border border-primary/16 bg-primary/10 text-primary",
  warning: "border border-secondary/16 bg-secondary/[0.08] text-secondary",
  danger: "border border-secondary/22 bg-secondary/[0.12] text-secondary",
  neutral: "border border-border/55 bg-background text-muted-foreground",
};

const ICON_TONES: Record<ChipTone, string> = {
  brand: "border border-primary/18 bg-primary/12 text-primary",
  success: "border border-primary/16 bg-primary/10 text-primary",
  warning: "border border-secondary/16 bg-secondary/[0.08] text-secondary",
  danger: "border border-secondary/22 bg-secondary/[0.12] text-secondary",
  neutral: "border border-border/55 bg-background text-muted-foreground",
};

const METRIC_TONES: Record<ChipTone, string> = {
  brand: "text-primary",
  success: "text-primary",
  warning: "text-secondary",
  danger: "text-secondary",
  neutral: "text-foreground",
};

export function SurfaceCard({
  variant = "default",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: SurfaceVariant;
}) {
  return (
    <div className={cn(SURFACE_VARIANTS[variant], className)} {...props}>
      {children}
    </div>
  );
}

export function StatusChip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        CHIP_TONES[tone],
        className
      )}
    >
      {children}
    </Badge>
  );
}

export interface InsightItem {
  value: ReactNode;
  label: string;
  tone?: ChipTone;
}

export function InsightRow({
  items,
  className,
}: {
  items: InsightItem[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2.5", className)}>
      {items.map(item => (
        <div
          key={`${item.label}-${item.value}`}
          className="inline-flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2"
        >
          <span
            className={cn(
              "text-sm font-bold tracking-tight",
              METRIC_TONES[item.tone ?? "neutral"]
            )}
          >
            {item.value}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function IconBadge({
  icon: Icon,
  tone = "brand",
  className,
}: {
  icon: LucideIcon;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[14px] transition-all duration-200",
        ICON_TONES[tone],
        className
      )}
    >
      <div className="absolute inset-0 bg-linear-to-tr from-foreground/5 to-transparent opacity-50 mix-blend-overlay" />
      <Icon className="relative h-4.5 w-4.5" strokeWidth={2.5} />
    </div>
  );
}

export function InlineMetric({
  label,
  value,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] bg-muted/30 px-3.5 py-3 border border-border/20 transition-all duration-200 hover:bg-muted/50 hover:border-border/35 hover:shadow-sm cursor-default",
        className
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-lg font-extrabold tracking-tight",
          METRIC_TONES[tone]
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function SegmentedProgressBar({
  segments,
  hideLegend = true,
  className,
  emptyMessage,
}: {
  segments: Array<{ label: string; value: number; tone?: Tone }>;
  hideLegend?: boolean;
  className?: string;
  emptyMessage?: string;
}) {
  return (
    <SegBar
      segments={segments}
      hideLegend={hideLegend}
      emptyMessage={emptyMessage}
      className={className}
    />
  );
}

export function IllustrationEmptyState({
  illustration,
  title,
  description,
  tone = "neutral",
  className,
}: {
  illustration: ReactNode;
  title: string;
  description: string;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-5 rounded-2xl bg-muted/20 px-6 py-6 border border-border/20 transition-colors duration-200 hover:bg-muted/30",
        className
      )}
    >
      <div className={cn("shrink-0", METRIC_TONES[tone])}>{illustration}</div>
      <div className="space-y-1.5 flex-1">
        <p className="text-base font-extrabold tracking-tight text-foreground">
          {title}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

export function EmptyStatePanel({
  icon: Icon,
  title,
  description,
  tone = "neutral",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: ChipTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl bg-muted/20 px-5 py-5 border border-border/20",
        className
      )}
    >
      <div className="relative shrink-0 flex items-center justify-center h-14 w-14 rounded-full bg-background border border-border/40 shadow-sm">
        <Icon
          className={cn("h-6 w-6 opacity-80", METRIC_TONES[tone])}
          strokeWidth={2}
        />
        <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-background" />
      </div>
      <div className="max-w-60 space-y-0.5">
        <p className="text-sm font-bold tracking-tight text-foreground">
          {title}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

export function ActionRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2.5", className)}>
      {children}
    </div>
  );
}

export function MetricBarZone({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-auto flex min-h-16 flex-col justify-end rounded-[14px] bg-muted/20 px-3.5 py-2.5 border border-border/20 dark:bg-white/2",
        className
      )}
    >
      {children}
    </div>
  );
}

export function KpiTile({
  title,
  value,
  detail,
  visual,
  tone = "neutral",
  onClick,
  className,
}: {
  title: string;
  value: ReactNode;
  detail: string;
  visual?: ReactNode;
  tone?: ChipTone;
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        SURFACE_VARIANTS.raised,
        "flex h-full flex-col gap-3 px-4 py-4 text-left",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
          {title}
        </p>
        <p
          className={cn(
            "text-[1.85rem] font-black leading-none tracking-tighter sm:text-[2rem]",
            METRIC_TONES[tone]
          )}
        >
          {value}
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
          {detail}
        </p>
      </div>
      {visual && <MetricBarZone>{visual}</MetricBarZone>}
    </Comp>
  );
}

export function UtilityPill({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
  action,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: ChipTone;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        k.utilityPill,
        "flex h-full items-start gap-3.5 px-3.5 py-3",
        className
      )}
    >
      <IconBadge icon={Icon} tone={tone} className="h-9 w-9 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            METRIC_TONES[tone]
          )}
        >
          {value}
        </p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function MetricCardHeader({
  icon: Icon,
  title,
  tone,
  badge,
}: {
  icon: any; // LucideIcon from 'lucide-react'
  title: string;
  tone: ChipTone;
  badge: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <IconBadge icon={Icon} tone={tone} />
        <div className="space-y-1 pt-0.5">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h3>
        </div>
      </div>
      <div className="shrink-0">{badge}</div>
    </div>
  );
}

export function CardFooter({ action }: { action: any }) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      className="group mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-all duration-200 hover:text-primary/80 hover:gap-2.5"
    >
      {action.label}
      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
    </button>
  );
}
