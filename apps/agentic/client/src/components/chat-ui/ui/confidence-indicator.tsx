import { motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge as PrimitiveBadge, cn } from "@hki/ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BRAND } from "@/design-system/tokens";

type ConfidenceLevel = "high" | "medium" | "low";

export interface ConfidenceIndicatorProps {
  score: number;
  label?: string;
  showBar?: boolean;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  explanation?: string;
  supportingEvidenceCount?: number;
  className?: string;
}

export interface ConfidenceBarProps {
  score: number;
  height?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export const getConfidenceLevel = (score: number): ConfidenceLevel => {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
};

export const confidenceConfig = {
  high: {
    color: BRAND.blue[600],
    ring: `color-mix(in srgb, ${BRAND.blue[500]} 28%, var(--border))`,
    pillBackground: `linear-gradient(180deg, color-mix(in srgb, ${BRAND.blue[500]} 14%, var(--card)) 0%, color-mix(in srgb, ${BRAND.blue[500]} 8%, var(--card)) 100%)`,
    label: "Grounded",
    headline: "Strong evidence match",
    icon: ShieldCheck,
    description:
      "This response is strongly backed by retrieved HKI knowledge and has a high grounding signal.",
    recommendation:
      "Open the citation chips below to inspect the exact supporting passages.",
  },
  medium: {
    color: BRAND.blue[700],
    ring: `color-mix(in srgb, ${BRAND.red[500]} 24%, var(--border))`,
    pillBackground: `linear-gradient(180deg, color-mix(in srgb, ${BRAND.blue[500]} 10%, var(--card)) 0%, color-mix(in srgb, ${BRAND.red[500]} 8%, var(--card)) 100%)`,
    label: "Review",
    headline: "Useful, but verify critical details",
    icon: ScanSearch,
    description:
      "This answer appears grounded, but important numbers, dates, or steps should be verified against the cited source.",
    recommendation:
      "Use the linked evidence before relying on the answer for an operational decision.",
  },
  low: {
    color: BRAND.red[600],
    ring: `color-mix(in srgb, ${BRAND.red[500]} 32%, var(--border))`,
    pillBackground: `linear-gradient(180deg, color-mix(in srgb, ${BRAND.red[500]} 14%, var(--card)) 0%, color-mix(in srgb, ${BRAND.red[500]} 8%, var(--card)) 100%)`,
    label: "Caution",
    headline: "Weak grounding signal",
    icon: AlertTriangle,
    description:
      "The model found limited supporting evidence for this answer, so it should be treated carefully.",
    recommendation:
      "Check the citations and KB library before using this response as guidance.",
  },
} as const;

export const sizeConfig = {
  sm: {
    text: "text-[10px]",
    score: "text-[10px]",
    icon: "h-3 w-3",
    padding: "px-2 py-0.5",
    gap: "gap-1.5",
  },
  md: {
    text: "text-[11px]",
    score: "text-xs",
    icon: "h-3.5 w-3.5",
    padding: "px-2.5 py-1",
    gap: "gap-2",
  },
  lg: {
    text: "text-xs",
    score: "text-sm",
    icon: "h-4 w-4",
    padding: "px-3 py-1.5",
    gap: "gap-2.5",
  },
} as const;

export function ConfidenceIndicator({
  score,
  label,
  showBar = true,
  showIcon = true,
  size = "sm",
  explanation,
  supportingEvidenceCount,
  className,
}: ConfidenceIndicatorProps) {
  const level = getConfidenceLevel(score);
  const config = confidenceConfig[level];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;
  const accentColor = `color-mix(in srgb, var(--foreground) 22%, ${config.color} 78%)`;
  const displayLabel = label || config.label;
  const displayExplanation = explanation || config.description;
  const roundedScore = Math.round(score);
  const evidenceLabel =
    supportingEvidenceCount && supportingEvidenceCount > 0
      ? `${supportingEvidenceCount} cited source${supportingEvidenceCount === 1 ? "" : "s"}`
      : "No citations attached";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <PrimitiveBadge
          asChild
          variant="outline"
          className={cn(
            "inline-flex shrink-0 cursor-pointer items-center rounded-full font-medium normal-case tracking-normal shadow-none transition-all duration-200",
            "hover:-translate-y-px hover:shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
            sizeStyles.padding,
            sizeStyles.gap,
            className
          )}
          style={{
            background: config.pillBackground,
            borderColor: config.ring,
          }}
        >
          <button
            type="button"
            aria-label={`Open confidence details for ${roundedScore} percent confidence`}
          >
            {showIcon ? (
              <span
                className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `color-mix(in srgb, ${config.color} 14%, transparent)`,
                  color: config.color,
                }}
              >
                <Icon className={sizeStyles.icon} />
              </span>
            ) : null}

            <span className="flex items-center gap-1.5 leading-none">
              <span
                className={cn(
                  "font-semibold uppercase tracking-[0.12em]",
                  sizeStyles.text
                )}
                style={{ color: accentColor }}
              >
                {displayLabel}
              </span>
              <span
                className={cn("font-bold tabular-nums", sizeStyles.score)}
                style={{ color: "var(--foreground)" }}
              >
                {roundedScore}%
              </span>
            </span>

            <ChevronDown
              className={cn(
                "h-3 w-3 shrink-0 opacity-60",
                size === "lg" && "h-3.5 w-3.5"
              )}
              style={{ color: accentColor }}
            />
          </button>
        </PrimitiveBadge>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={10}
        className="w-88 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border p-0"
      >
        <div
          className="border-b px-4 py-3"
          style={{
            background: config.pillBackground,
            borderColor: config.ring,
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: config.color }}
          >
            Response Confidence
          </p>
          <div className="mt-2 flex items-start gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `color-mix(in srgb, ${config.color} 14%, transparent)`,
              }}
            >
              <Icon className="h-4 w-4" style={{ color: config.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {config.headline}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {roundedScore}% confidence match
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {displayExplanation}
          </p>

          <div
            className="flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{
              borderColor: `color-mix(in srgb, ${config.color} 14%, var(--border))`,
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--card) 96%, white 4%) 0%, var(--card) 100%)",
            }}
          >
            <Sparkles
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: config.color }}
            />
            <span className="text-xs font-medium text-foreground">
              {evidenceLabel}
            </span>
          </div>

          {showBar ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Grounding strength</span>
                <span className="tabular-nums text-foreground">
                  {roundedScore}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(score, 100))}%` }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full"
                  style={{ background: config.color }}
                />
              </div>
            </div>
          ) : null}

          <div
            className="rounded-xl border px-3 py-2.5"
            style={{
              borderColor: config.ring,
              background: `color-mix(in srgb, ${config.color} 5%, var(--card))`,
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
              How To Use It
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {config.recommendation}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ConfidenceBar({
  score,
  height = "sm",
  showLabel = false,
  className,
}: ConfidenceBarProps) {
  const level = getConfidenceLevel(score);
  const config = confidenceConfig[level];
  const heightClass =
    height === "sm" ? "h-1" : height === "md" ? "h-1.5" : "h-2";

  return (
    <div className={cn("w-full space-y-1", className)}>
      {showLabel ? (
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: "var(--muted-foreground)" }}>Confidence</span>
          <span className="font-medium" style={{ color: config.color }}>
            {Math.round(score)}%
          </span>
        </div>
      ) : null}
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-muted/70",
          heightClass
        )}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(score, 100))}%`,
            background: config.color,
          }}
        />
      </div>
    </div>
  );
}
