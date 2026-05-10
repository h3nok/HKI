/**
 * Knowledge Domains — Reusable UI Primitives
 *
 * Shared page shell, segmented control, search bar, and filter bar used across
 * all KB tabs. One source of truth for layout, spacing, and active-state colors.
 *
 * Usage:
 *   import { KBPageHeader, KBSegmentedControl, KBSearchBar, KBFilterBar } from './kb-primitives';
 */

import type { ReactNode, KeyboardEvent } from "react";
import {
  ArrowRight,
  Search,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@hki/ui";
import { k } from "../theme";
import { cardCls } from "../types";

export const KB_HKI_EMOJI = {
  warehouse: { value: "🏬", label: "Warehouse" },
  member: { value: "🛒", label: "Member flow" },
  docs: { value: "📚", label: "Knowledge content" },
  policy: { value: "📋", label: "Playbook" },
  test: { value: "🧪", label: "Evaluation" },
  trust: { value: "🛡️", label: "Trust and safety" },
  launch: { value: "🚀", label: "Deployment" },
  operations: { value: "🧰", label: "Operations" },
  team: { value: "🤝", label: "Team ownership" },
  refresh: { value: "🔄", label: "Refresh cadence" },
  rollout: { value: "📦", label: "Release bundle" },
  signal: { value: "📣", label: "Feedback signal" },
} as const;

export type KBHKIEmojiKey = keyof typeof KB_HKI_EMOJI;

export function KBEmojiBadge({
  emoji,
  className,
  title,
  size = "md",
}: {
  emoji: KBHKIEmojiKey;
  className?: string;
  title?: string;
  size?: "sm" | "md";
}) {
  const entry = KB_HKI_EMOJI[emoji];
  return (
    <span
      aria-hidden="true"
      title={title ?? entry.label}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 shadow-sm",
        size === "sm" ? "h-8 w-8 text-base" : "h-10 w-10 text-lg",
        className
      )}
    >
      {entry.value}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. PAGE HEADER — icon · title · description · actions slot
// ══════════════════════════════════════════════════════════════════════════════

interface KBPageHeaderProps {
  icon: LucideIcon;
  title: string;
  /** Optional subtitle below the title */
  description?: string;
  /** Optional accent-colored metadata line (e.g. stream label) */
  accent?: ReactNode;
  /** Right-aligned slot for actions, controls, or a segmented control */
  actions?: ReactNode;
  className?: string;
}

export function KBPageHeader({
  icon: Icon,
  title,
  description,
  accent,
  actions,
  className,
}: KBPageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between flex-wrap gap-4",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
          <Icon className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {accent && (
            <p className={cn("text-xs mt-0.5", k.accentText)}>{accent}</p>
          )}
          {description && !accent && (
            <p className={cn("text-sm mt-0.5", k.muted)}>{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. SEGMENTED CONTROL — consistent active-state across all KB tabs
// ══════════════════════════════════════════════════════════════════════════════

export interface SegmentItem<K extends string = string> {
  key: K;
  label: string;
  icon?: LucideIcon;
  /** Optional badge count (e.g. pending review count) */
  badge?: number;
}

interface KBSegmentedControlProps<K extends string = string> {
  items: SegmentItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Accessible label for role="tablist" */
  ariaLabel?: string;
  className?: string;
}

/**
 * Unified active state: `kb-duotone-fill shadow-sm`
 * Matches HKI Iris design token — used consistently on every KB tab.
 */
export function KBSegmentedControl<K extends string = string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: KBSegmentedControlProps<K>) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 p-1 rounded-xl bg-muted/50",
        className
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map(item => {
        const isActive = value === item.key;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.key)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all",
              isActive
                ? k.duoToneSurfaceActive
                : cn("text-muted-foreground", k.duoToneHover)
            )}
          >
            {item.icon && <item.icon className="w-3.5 h-3.5" />}
            {item.label}
            {typeof item.badge === "number" && item.badge > 0 && (
              <span
                className={cn(
                  "ml-0.5 min-w-5 px-1.5 rounded-full text-[11px] font-bold text-center",
                  isActive
                    ? "bg-primary-foreground/14 text-primary-foreground ring-1 ring-inset ring-primary-foreground/18"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. SEARCH BAR — reusable inline search input
// ══════════════════════════════════════════════════════════════════════════════

interface KBSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  className?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

export function KBSearchBar({
  value,
  onChange,
  placeholder = "Search...",
  onSubmit,
  className,
  autoFocus,
}: KBSearchBarProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onSubmit) onSubmit();
  };
  return (
    <div className={cn("relative flex-1 max-w-md", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(k.input, k.duoToneField, "pl-9 h-9 text-xs")}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. FILTER BAR — inline status / category pill row
// ══════════════════════════════════════════════════════════════════════════════

export interface FilterOption<V extends string = string> {
  value: V;
  label: string;
  icon?: LucideIcon;
  /** Count badge shown after the label */
  count?: number;
}

interface KBFilterBarProps<V extends string = string> {
  options: FilterOption<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
}

export function KBFilterBar<V extends string = string>({
  options,
  value,
  onChange,
  className,
}: KBFilterBarProps<V>) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 p-1 rounded-xl bg-muted/50",
        className
      )}
    >
      {options.map(opt => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all",
              isActive
                ? k.duoToneSurfaceActive
                : cn("text-muted-foreground", k.duoToneHover)
            )}
          >
            {opt.icon && <opt.icon className="w-3 h-3" />}
            {opt.label}
            {typeof opt.count === "number" && (
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  isActive
                    ? "text-primary-foreground/85"
                    : "text-muted-foreground/60"
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. TOOLBAR — search bar + filter bar combined row
// ══════════════════════════════════════════════════════════════════════════════

interface KBToolbarProps {
  children: ReactNode;
  className?: string;
}

/** Horizontal row that wraps search, filter bars, and action buttons together */
export function KBToolbar({ children, className }: KBToolbarProps) {
  return (
    <div className={cn("flex items-center gap-3 flex-wrap", className)}>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. SECTION CARD — consistent card wrapper for content sections
// ══════════════════════════════════════════════════════════════════════════════

interface KBSectionCardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function KBSectionCard({
  children,
  className,
  padding = true,
}: KBSectionCardProps) {
  return (
    <div className={cn(cardCls, padding && "p-5", className)}>{children}</div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. EMPTY STATE — consistent empty / placeholder panel
// ══════════════════════════════════════════════════════════════════════════════

interface KBEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function KBEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: KBEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-muted/60 mb-4">
        <Icon className="w-5 h-5 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className={cn("text-xs mt-1 max-w-xs", k.muted)}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. DUO-TONE ICON — icon with tinted background box
// ══════════════════════════════════════════════════════════════════════════════

/** Color presets — bg/text/border combos for duo-tone styling */
export const DUOTONE = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/15",
  green:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15",
  amber: "bg-primary/10 text-primary border-primary/15",
  red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/15",
  purple:
    "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/15",
  primary: "kb-duotone-fill border-primary/15",
  muted: "bg-muted text-muted-foreground border-border/50",
} as const;

export type DuoTone = keyof typeof DUOTONE;

interface KBDuoIconProps {
  icon: LucideIcon;
  tone?: DuoTone;
  /** Emoji to show instead of icon — takes precedence */
  emoji?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const ICON_SIZE_MAP = {
  sm: { box: "w-7 h-7 rounded-lg", icon: "w-3.5 h-3.5", emoji: "text-sm" },
  md: { box: "w-9 h-9 rounded-xl", icon: "w-4 h-4", emoji: "text-base" },
  lg: { box: "w-11 h-11 rounded-xl", icon: "w-5 h-5", emoji: "text-lg" },
} as const;

export function KBDuoIcon({
  icon: Icon,
  tone = "primary",
  emoji,
  size = "md",
  className,
}: KBDuoIconProps) {
  const s = ICON_SIZE_MAP[size];
  return (
    <div
      className={cn(
        s.box,
        "flex items-center justify-center shrink-0 border",
        DUOTONE[tone],
        className
      )}
    >
      {emoji ? (
        <span className={s.emoji}>{emoji}</span>
      ) : (
        <Icon className={s.icon} />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. METRIC TILE — duo-tone stat card with icon + value + label
// ══════════════════════════════════════════════════════════════════════════════

interface KBMetricTileProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: DuoTone;
  emoji?: string;
  className?: string;
}

export function KBMetricTile({
  icon,
  label,
  value,
  tone = "primary",
  emoji,
  className,
}: KBMetricTileProps) {
  return (
    <div className={cn(cardCls, "flex items-center gap-3 p-4", className)}>
      <KBDuoIcon icon={icon} tone={tone} emoji={emoji} size="md" />
      <div className="min-w-0">
        <p className="text-lg font-bold tabular-nums text-foreground leading-none">
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 10. PIPELINE STRIP — horizontal workflow stages breadcrumb
// ══════════════════════════════════════════════════════════════════════════════

interface KBPipelineStripProps {
  stages: string[];
  /** 0-indexed current active stage (-1 = none) */
  current?: number;
  className?: string;
}

export function KBPipelineStrip({
  stages,
  current = -1,
  className,
}: KBPipelineStripProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-xl bg-muted/40 px-3 py-2 text-xs overflow-x-auto",
        className
      )}
    >
      {stages.map((stage, i) => {
        const isPast = i < current;
        const isActive = i === current;
        return (
          <span key={stage} className="flex items-center gap-1 shrink-0">
            {i > 0 && (
              <ChevronRight className="w-3 h-3 text-muted-foreground/40 mx-0.5" />
            )}
            <span
              className={cn(
                "font-medium transition-colors",
                isActive && "text-primary font-semibold",
                isPast && "text-emerald-600 dark:text-emerald-400",
                !isActive && !isPast && "text-muted-foreground"
              )}
            >
              {isPast ? "✓ " : ""}
              {stage}
            </span>
          </span>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 11. STATUS DOT — tiny colored indicator pill
// ══════════════════════════════════════════════════════════════════════════════

interface KBStatusDotProps {
  tone?: DuoTone;
  label?: string;
  pulse?: boolean;
  className?: string;
}

export function KBStatusDot({
  tone = "primary",
  label,
  pulse,
  className,
}: KBStatusDotProps) {
  const colors = DUOTONE[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative flex h-2 w-2">
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-50",
              colors.split(" ")[0]
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            colors.split(" ")[0]
          )}
        />
      </span>
      {label && (
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
      )}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 12. INFO BANNER — duo-tone callout/tip strip
// ══════════════════════════════════════════════════════════════════════════════

interface KBInfoBannerProps {
  icon?: LucideIcon;
  emoji?: string;
  tone?: DuoTone;
  children: ReactNode;
  className?: string;
}

export function KBInfoBanner({
  icon: Icon,
  emoji,
  tone = "blue",
  children,
  className,
}: KBInfoBannerProps) {
  const bg = DUOTONE[tone];
  return (
    <div
      className={cn(
        "kb-info-banner flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed",
        bg,
        className
      )}
    >
      {(emoji || Icon) && (
        <span className="shrink-0 mt-0.5 text-sm">
          {emoji ?? (Icon && <Icon className="w-3.5 h-3.5" />)}
        </span>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 13. WORKFLOW BANNER — page-level "where you are / what's next" banner
// ══════════════════════════════════════════════════════════════════════════════

interface KBWorkflowMetric {
  label: string;
  value: ReactNode;
}

interface KBWorkflowAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  tone?: "primary" | "secondary";
  disabled?: boolean;
  testId?: string;
}

interface KBWorkflowBannerProps {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  eyebrow?: string;
  tone?: DuoTone;
  statusLabel?: string;
  statusTone?: DuoTone;
  metrics?: KBWorkflowMetric[];
  primaryAction?: KBWorkflowAction;
  secondaryAction?: KBWorkflowAction;
  className?: string;
  testId?: string;
}

const STATUS_PILL = "kb-workflow-status-pill border-border/55 bg-background";

const PRIMARY_WORKFLOW_ACTION = cn(
  "border border-primary/18 shadow-sm hover:-translate-y-px",
  k.duoToneAccentSolid,
  k.duoToneAccentSolidHover
);

const SECONDARY_WORKFLOW_ACTION = cn(
  "kb-workflow-action-secondary border border-border/55 bg-background text-foreground shadow-none hover:-translate-y-px hover:border-border/75",
  k.duoToneHover,
  k.duoToneTextHover
);

const STATUS_TEXT_COLOR: Record<DuoTone, string> = {
  blue: "text-blue-600 dark:text-blue-400",
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-primary",
  red: "text-red-600 dark:text-red-400",
  purple: "text-purple-600 dark:text-purple-400",
  primary: "text-primary",
  muted: "text-muted-foreground",
};

export function KBWorkflowBanner({
  icon: Icon,
  title,
  description,
  eyebrow,
  tone = "primary",
  statusLabel,
  statusTone = "primary",
  metrics = [],
  primaryAction,
  secondaryAction,
  className,
  testId,
}: KBWorkflowBannerProps) {
  const renderAction = (action: KBWorkflowAction, primary: boolean) => {
    const ActionIcon = action.icon ?? ArrowRight;
    return (
      <button
        key={action.label}
        type="button"
        onClick={action.onClick}
        disabled={action.disabled}
        data-testid={action.testId}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          primary ? PRIMARY_WORKFLOW_ACTION : SECONDARY_WORKFLOW_ACTION,
          action.disabled && "cursor-not-allowed opacity-40"
        )}
      >
        <ActionIcon className="h-3.5 w-3.5 shrink-0" />
        {action.label}
      </button>
    );
  };

  return (
    <div
      data-testid={testId}
      className={cn(
        cardCls,
        "kb-workflow-banner relative overflow-hidden rounded-t-3xl rounded-b-none border border-border/50 shadow-sm",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-5 top-0 h-px bg-border/65" />
        <div className="absolute bottom-4 left-5 h-10 w-px bg-border/35" />
      </div>

      <div className="relative px-5 py-4">
        <div className="flex items-center gap-4">
          {/* Left: icon + text */}
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <KBDuoIcon icon={Icon} tone={tone} size="lg" className="mt-0.5" />

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {eyebrow && (
                  <span className="kb-workflow-eyebrow rounded-full border border-border/55 bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/72">
                    {eyebrow}
                  </span>
                )}
                {eyebrow && statusLabel && (
                  <span className="text-muted-foreground/30 text-[10px]">
                    ·
                  </span>
                )}
                {statusLabel && (
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                      STATUS_PILL,
                      STATUS_TEXT_COLOR[statusTone]
                    )}
                  >
                    {statusLabel}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <h2 className="text-[15px] font-semibold tracking-tight text-foreground leading-snug">
                  {title}
                </h2>

                {description && (
                  <p className="max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>

              {metrics.length > 0 && (
                <div className="flex flex-wrap gap-2.5 pt-1">
                  {metrics.map(metric => (
                    <div
                      key={metric.label}
                      className="kb-workflow-metric rounded-xl border border-border/50 bg-muted/30 px-3 py-2"
                    >
                      <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                        {metric.label}
                      </span>
                      <span className="block text-sm font-semibold text-foreground tabular-nums">
                        {metric.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: action buttons */}
          {(primaryAction || secondaryAction) && (
            <div className="flex shrink-0 items-center gap-2">
              {secondaryAction && renderAction(secondaryAction, false)}
              {primaryAction && renderAction(primaryAction, true)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 14. ACTION TOOLBAR — row of actions with left/right slots
// ══════════════════════════════════════════════════════════════════════════════

interface KBActionToolbarProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function KBActionToolbar({
  left,
  right,
  className,
}: KBActionToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 flex-wrap",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">{left}</div>
      <div className="flex items-center gap-2 shrink-0">{right}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 15. TOP BAR — single skinny action/filter/nav bar for all KB tabs
// ══════════════════════════════════════════════════════════════════════════════

interface KBTopBarProps<K extends string = string> {
  /** Segmented tab items */
  tabs?: SegmentItem<K>[];
  /** Currently active tab key */
  activeTab?: K;
  /** Tab change handler */
  onTabChange?: (key: K) => void;
  /** Accessible label for the tab list */
  tabsAriaLabel?: string;
  /** Pipeline breadcrumb stages (e.g. ["Submit","Review","Approve","Publish","Live"]) */
  pipeline?: string[];
  /** 0-indexed active pipeline stage */
  pipelineStep?: number;
  /** Right-aligned action buttons / filters */
  actions?: ReactNode;
  className?: string;
}

export function KBTopBar<K extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  tabsAriaLabel,
  pipeline,
  pipelineStep,
  actions,
  className,
}: KBTopBarProps<K>) {
  const hasTabs = tabs && tabs.length > 0;
  const hasPipeline = pipeline && pipeline.length > 0;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 flex-wrap rounded-xl bg-card/80 border border-black/4 dark:border-white/6 px-3 py-1.5",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0 overflow-x-auto">
        {hasTabs && (
          <KBSegmentedControl
            items={tabs}
            value={activeTab!}
            onChange={onTabChange!}
            ariaLabel={tabsAriaLabel}
          />
        )}
        {hasPipeline && (
          <KBPipelineStrip stages={pipeline} current={pipelineStep} />
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
