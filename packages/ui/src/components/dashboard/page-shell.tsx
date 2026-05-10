import * as React from "react";
import { cn } from "../../utils";
import { GridBackground, type GridBackgroundProps } from "./grid-background";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface PageShellProps {
  /** Ordered breadcrumb items — last item is rendered as plain text (current page) */
  breadcrumbs?: BreadcrumbItem[];
  /** Action slot rendered in the top-right (e.g. theme toggle) */
  actions?: React.ReactNode;
  /** Main page content */
  children: React.ReactNode;
  /** Max width class — defaults to max-w-[1400px] standalone, full-width when embedded */
  maxWidth?: string;
  /** Grid background props (pass `theme` for dynamic color) */
  grid?: GridBackgroundProps | false;
  /** When true, strips own background/min-h-screen — use inside an AppLayout or similar wrapper */
  embedded?: boolean;
  /** Additional class names on the outer wrapper */
  className?: string;
}

/**
 * Full-page shell with grid background, breadcrumb bar, and content area.
 * Provides consistent layout across dashboard pages.
 *
 * @example
 * <PageShell
 *   breadcrumbs={[{ label: "Hub", href: "/" }, { label: "Capabilities" }]}
 *   actions={<ThemeToggle />}
 *   grid={{ theme }}
 * >
 *   <h1>…</h1>
 * </PageShell>
 */
export function PageShell({
  breadcrumbs,
  actions,
  children,
  maxWidth,
  grid,
  embedded = false,
  className,
}: PageShellProps) {
  const resolvedMaxWidth = maxWidth ?? (embedded ? "" : "max-w-[1400px]");

  return (
    <div
      className={cn(
        "relative",
        !embedded && "min-h-screen bg-[#faf9f7] dark:bg-[#111111] text-[#3f3e3d] dark:text-[#d1d0cd] transition-colors",
        embedded && "flex-1",
        className
      )}
    >
      {grid !== false && <GridBackground {...(typeof grid === "object" ? grid : {})} />}

      <div className={cn("relative z-10 w-full mx-auto px-6 sm:px-10 py-8 sm:py-10", resolvedMaxWidth)}>
        {/* Top bar: breadcrumbs + actions */}
        {(breadcrumbs || actions) && (
          <div className="flex items-center justify-between mb-8">
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav className="flex items-center gap-1.5" aria-label="Breadcrumb">
                {breadcrumbs.map((crumb, i) => {
                  const isLast = i === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#d1d0cd] dark:text-[#444444] shrink-0" aria-hidden="true">
                          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {isLast ? (
                        <span className="text-sm font-semibold text-[#1a1a19] dark:text-[#f5f4f1]" aria-current="page">
                          {crumb.label}
                        </span>
                      ) : crumb.onClick ? (
                        <button
                          type="button"
                          onClick={crumb.onClick}
                          className="text-sm text-[#8a8986] dark:text-[#6f6e6b] hover:text-[#0E7C7B] dark:hover:text-[#1FA9A5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B] focus-visible:ring-offset-2 rounded-md px-0.5"
                        >
                          {crumb.label}
                        </button>
                      ) : (
                        <a
                          href={crumb.href ?? "#"}
                          className="text-sm text-[#8a8986] dark:text-[#6f6e6b] hover:text-[#0E7C7B] dark:hover:text-[#1FA9A5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B] focus-visible:ring-offset-2 rounded-md px-0.5"
                        >
                          {crumb.label}
                        </a>
                      )}
                    </React.Fragment>
                  );
                })}
              </nav>
            )}
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
