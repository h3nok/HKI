import * as React from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@hki/ui";
import { SidebarTrigger } from "@/components/ui/sidebar";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BreadcrumbSegment {
  /** Display label */
  label: string;
  /** Optional icon rendered before the label */
  icon?: LucideIcon;
  /** Icon color class (e.g. "text-emerald-500") */
  iconClassName?: string;
  /** Extra className applied to the segment wrapper (e.g. pill styling) */
  className?: string;
  /** If true, label is hidden on mobile (icon still shows) */
  hideOnMobile?: boolean;
  /** Optional click handler to make the segment interactive */
  onClick?: () => void;
}

export interface BreadcrumbBarProps {
  /** Ordered breadcrumb segments — last one is rendered as the active page */
  segments: BreadcrumbSegment[];
  /** Element rendered absolutely centered in the bar */
  center?: React.ReactNode;
  /** Extra elements rendered on the right side of the bar (e.g. actions) */
  trailing?: React.ReactNode;
  /** Additional className for the header element */
  className?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function BreadcrumbBar({
  segments,
  center,
  trailing,
  className,
}: BreadcrumbBarProps) {
  const lastIdx = segments.length - 1;

  return (
    <header
      className={cn(
        "dashboard-breadcrumb sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 px-4 sm:px-6 bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      <SidebarTrigger className="-ml-1 size-8 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground" />

      <nav
        data-breadcrumb-nav
        className="flex min-w-0 flex-1 items-center gap-1 text-[15px]"
      >
        {segments.map((seg, idx) => {
          const isLast = idx === lastIdx;
          const Icon = seg.icon;
          const segmentState = isLast
            ? "active"
            : seg.onClick
              ? "interactive"
              : "passive";

          return (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <ChevronRight
                  className="w-3 h-3 text-muted-foreground/45 shrink-0"
                  aria-hidden
                />
              )}
              <span
                data-breadcrumb-segment={segmentState}
                role={seg.onClick ? "button" : undefined}
                tabIndex={seg.onClick ? 0 : undefined}
                onClick={seg.onClick}
                onKeyDown={
                  seg.onClick
                    ? e => {
                        if (e.key === "Enter") seg.onClick!();
                      }
                    : undefined
                }
                className={cn(
                  "flex shrink-0 items-center gap-2",
                  isLast
                    ? "font-semibold text-foreground truncate"
                    : "text-muted-foreground",
                  seg.onClick &&
                    !isLast &&
                    "cursor-pointer hover:text-foreground transition-colors",
                  seg.className
                )}
              >
                {Icon && (
                  <Icon className={cn("w-4 h-4 shrink-0", seg.iconClassName)} />
                )}
                <span className={cn(seg.hideOnMobile && "hidden sm:inline")}>
                  {seg.label}
                </span>
              </span>
            </React.Fragment>
          );
        })}
      </nav>

      {center && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto">{center}</div>
        </div>
      )}

      {trailing && (
        <div
          data-breadcrumb-trailing
          className="flex shrink-0 items-center gap-2"
        >
          {trailing}
        </div>
      )}
    </header>
  );
}
