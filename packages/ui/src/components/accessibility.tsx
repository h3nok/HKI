"use client";

import * as React from "react";

// ============================================================================
// Skip-to-Content Link
// ============================================================================

export interface SkipToContentProps {
  /** Target element ID (without #). Defaults to "main-content" */
  targetId?: string;
  /** Label text */
  label?: string;
  className?: string;
}

/**
 * Keyboard-only skip link that appears on focus.
 * Place as the first child of <body> or your root layout.
 *
 * The target element needs `id={targetId}` and `tabIndex={-1}`.
 */
export function SkipToContent({
  targetId = "main-content",
  label = "Skip to main content",
  className,
}: SkipToContentProps): React.ReactElement {
  return (
    <a
      href={`#${targetId}`}
      className={
        className ??
        [
          "sr-only focus:not-sr-only",
          "focus:fixed focus:top-4 focus:left-4 focus:z-[9999]",
          "focus:px-4 focus:py-2 focus:rounded-lg",
          "focus:bg-primary focus:text-primary-foreground",
          "focus:text-sm focus:font-semibold focus:shadow-lg",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "transition-none",
        ].join(" ")
      }
    >
      {label}
    </a>
  );
}

SkipToContent.displayName = "SkipToContent";

// ============================================================================
// Route Announcer (for SPA navigation)
// ============================================================================

export interface RouteAnnouncerProps {
  /** The current route title to announce */
  title: string;
}

/**
 * Visually hidden live region that announces route changes to screen readers.
 * Update `title` on each route change.
 *
 * @example
 * ```tsx
 * const location = useLocation();
 * <RouteAnnouncer title={`Navigated to ${pageName}`} />
 * ```
 */
export function RouteAnnouncer({
  title,
}: RouteAnnouncerProps): React.ReactElement {
  return (
    <div
      role="status"
      aria-live="assertive"
      aria-atomic="true"
      className="sr-only"
    >
      {title}
    </div>
  );
}

RouteAnnouncer.displayName = "RouteAnnouncer";
