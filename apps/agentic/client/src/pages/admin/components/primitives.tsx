import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Button, cn, type ButtonProps } from "@hki/ui";
import { Badge } from "@/components/ui/badge";
import { a } from "../theme";
import { SOFT_BADGE_CLASS, TONE_STYLES } from "../constants";
import type { FeatureFlagListItem, Tone } from "../types";

export function SectionPill({
  label,
  icon: Icon,
  className,
}: {
  label: string;
  icon: LucideIcon;
  className: string;
}) {
  return (
    <span
      className={cn(
        className,
        "inline-flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function ActionAffordance({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/82",
        className
      )}
    >
      {label}
      <ArrowRight className="h-3 w-3" />
    </span>
  );
}

function getSettingsButtonClass(variant: ButtonProps["variant"]) {
  switch (variant) {
    case "brand":
      return "border border-primary/35 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground hover:shadow-md";
    case "outline":
      return "!border-border/75 !bg-background !text-foreground shadow-sm hover:!border-border hover:!bg-accent/70 hover:!text-foreground";
    case "ghost":
      return "!text-foreground/88 hover:!bg-accent/75 hover:!text-foreground";
    default:
      return "shadow-sm";
  }
}

export function SettingsButton({
  variant = "default",
  className,
  style,
  ...props
}: ButtonProps) {
  const resolvedStyle =
    variant === "brand"
      ? {
          backgroundImage: "none",
          backgroundColor: "var(--primary)",
          borderColor: "color-mix(in srgb, var(--primary) 72%, var(--border))",
          color: "var(--primary-foreground)",
          boxShadow:
            "0 1px 2px color-mix(in srgb, var(--foreground) 8%, transparent), 0 10px 22px color-mix(in srgb, var(--primary) 18%, transparent)",
          ...style,
        }
      : style;

  return (
    <Button
      variant={variant}
      className={cn(
        "transition-[background-color,border-color,color,box-shadow]",
        getSettingsButtonClass(variant),
        className
      )}
      style={resolvedStyle}
      {...props}
    />
  );
}

export function DisclosureAffordance({
  isOpen,
  openLabel = "Show details",
  closeLabel = "Hide details",
}: {
  isOpen: boolean;
  openLabel?: string;
  closeLabel?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/72">
      {isOpen ? closeLabel : openLabel}
      {isOpen ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
    </span>
  );
}

export function SectionActionButton({
  label,
  icon: Icon,
  variant = "outline",
  disabled,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  variant?: "default" | "outline" | "brand";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <SettingsButton
      size="sm"
      variant={variant}
      disabled={disabled}
      onClick={onClick}
      className="min-w-46 justify-between rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm"
    >
      <span className="inline-flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <ArrowRight className="h-3.5 w-3.5 opacity-80" />
    </SettingsButton>
  );
}

export function StateBadge({ enabled }: { enabled: boolean }) {
  return (
    <Badge
      className={cn(enabled ? a.pillPositive : a.pillNeutral, SOFT_BADGE_CLASS)}
    >
      {enabled ? "Enabled" : "Disabled"}
    </Badge>
  );
}

export function SourceBadge({
  source,
}: {
  source: FeatureFlagListItem["source"];
}) {
  return (
    <Badge
      className={cn(
        source === "admin_override" ? a.pillWarning : a.pillNeutral,
        SOFT_BADGE_CLASS
      )}
    >
      {source === "admin_override" ? "Admin Override" : "Default"}
    </Badge>
  );
}

export function TabSectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}
