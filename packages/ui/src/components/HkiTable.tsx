/**
 * HKI Table Primitive
 * Premium data table with glass surface matching HkiCard.
 *
 * Features:
 * - Glass surface tokens aligned with HkiCard
 * - Sortable columns with indicator arrows
 * - Sticky header support
 * - Loading skeleton state
 * - Built-in empty state slot
 * - Composable sub-components for full flexibility
 *
 * @module @hki/ui/components/HkiTable
 */

import * as React from "react";
import { cn } from "../utils";

// ═══════════════════════════════════════════════════════════════════════════════
// Surface tokens (shared with HkiCard default variant)
// ═══════════════════════════════════════════════════════════════════════════════

const TABLE_SURFACE = [
  "bg-white/60 dark:bg-card/95",
  "backdrop-blur-xl dark:backdrop-blur-none",
  "border border-black/[0.04] dark:border-white/[0.04]",
  "rounded-2xl overflow-hidden",
  "shadow-[0_2px_12px_rgba(0,0,0,0.02)]",
  "dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)]",
].join(" ");

const THEAD_SURFACE = "bg-black/[0.02] dark:bg-white/[0.02]";

const TH_BASE = [
  "px-4 py-2.5",
  "text-xs font-semibold",
  "text-muted-foreground",
  "uppercase tracking-wider",
].join(" ");

const TD_BASE = "px-4 py-3";

const TR_HOVER = "hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors";

// ═══════════════════════════════════════════════════════════════════════════════
// HkiTable — Root wrapper
// ═══════════════════════════════════════════════════════════════════════════════

export interface HkiTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Additional class names for the outer wrapper */
  wrapperClassName?: string;
  /** Show loading skeleton instead of children */
  loading?: boolean;
  /** Number of skeleton rows to show when loading (default: 5) */
  loadingRows?: number;
  /** Number of skeleton columns (default: 4) */
  loadingCols?: number;
  /** Content to show when table body is empty */
  emptyState?: React.ReactNode;
}

export const HkiTable = React.forwardRef<HTMLTableElement, HkiTableProps>(
  (
    {
      className,
      wrapperClassName,
      loading,
      loadingRows = 5,
      loadingCols = 4,
      emptyState,
      children,
      ...props
    },
    ref
  ) => (
    <div className={cn(TABLE_SURFACE, wrapperClassName)}>
      {loading ? (
        <table className={cn("w-full text-sm", className)}>
          <thead className={THEAD_SURFACE}>
            <tr>
              {Array.from({ length: loadingCols }).map((_, i) => (
                <th key={i} className={TH_BASE}>
                  <div className="h-3 w-16 rounded bg-muted-foreground/10 animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: loadingRows }).map((_, rowIdx) => (
              <tr key={rowIdx}>
                {Array.from({ length: loadingCols }).map((_, colIdx) => (
                  <td key={colIdx} className={TD_BASE}>
                    <div
                      className="h-4 rounded bg-muted-foreground/8 animate-pulse"
                      style={{ width: `${50 + Math.random() * 40}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <table ref={ref} className={cn("w-full text-sm", className)} {...props}>
            {children}
          </table>
          {emptyState}
        </>
      )}
    </div>
  )
);
HkiTable.displayName = "HkiTable";

// ═══════════════════════════════════════════════════════════════════════════════
// HkiThead
// ═══════════════════════════════════════════════════════════════════════════════

export interface HkiTheadProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  /** Make the header sticky (useful for scrollable tables) */
  sticky?: boolean;
}

export const HkiThead = React.forwardRef<HTMLTableSectionElement, HkiTheadProps>(
  ({ className, sticky = false, children, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn(THEAD_SURFACE, sticky && "sticky top-0 z-10", className)}
      {...props}
    >
      {children}
    </thead>
  )
);
HkiThead.displayName = "HkiThead";

// ═══════════════════════════════════════════════════════════════════════════════
// HkiTbody
// ═══════════════════════════════════════════════════════════════════════════════

export const HkiTbody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, children, ...props }, ref) => (
  <tbody ref={ref} className={cn("divide-y divide-border", className)} {...props}>
    {children}
  </tbody>
));
HkiTbody.displayName = "HkiTbody";

// ═══════════════════════════════════════════════════════════════════════════════
// HkiTr
// ═══════════════════════════════════════════════════════════════════════════════

export interface HkiTrProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Disable hover highlight */
  noHover?: boolean;
  /** Whether the row is selected */
  selected?: boolean;
}

export const HkiTr = React.forwardRef<HTMLTableRowElement, HkiTrProps>(
  ({ className, noHover = false, selected = false, children, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(!noHover && TR_HOVER, selected && "bg-primary/5 dark:bg-primary/10", className)}
      {...props}
    >
      {children}
    </tr>
  )
);
HkiTr.displayName = "HkiTr";

// ═══════════════════════════════════════════════════════════════════════════════
// HkiTh — with optional sorting
// ═══════════════════════════════════════════════════════════════════════════════

export type SortDirection = "asc" | "desc" | null;

export interface HkiThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Text alignment shorthand */
  align?: "left" | "center" | "right";
  /** Enable sortable column */
  sortable?: boolean;
  /** Current sort state for this column */
  sortDirection?: SortDirection;
  /** Callback when user clicks to sort */
  onSort?: () => void;
}

export const HkiTh = React.forwardRef<HTMLTableCellElement, HkiThProps>(
  ({ className, align = "left", sortable, sortDirection, onSort, children, ...props }, ref) => {
    const sortIcon = sortDirection === "asc" ? "↑" : sortDirection === "desc" ? "↓" : "↕";

    return (
      <th
        ref={ref}
        className={cn(
          TH_BASE,
          `text-${align}`,
          sortable && "cursor-pointer select-none hover:text-foreground transition-colors",
          className
        )}
        onClick={sortable ? onSort : undefined}
        aria-sort={
          sortDirection === "asc"
            ? "ascending"
            : sortDirection === "desc"
              ? "descending"
              : undefined
        }
        {...props}
      >
        <span className="inline-flex items-center gap-1">
          {children}
          {sortable && (
            <span className={cn("text-[10px]", sortDirection ? "opacity-80" : "opacity-30")}>
              {sortIcon}
            </span>
          )}
        </span>
      </th>
    );
  }
);
HkiTh.displayName = "HkiTh";

// ═══════════════════════════════════════════════════════════════════════════════
// HKITd
// ═══════════════════════════════════════════════════════════════════════════════

export const HKITd = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, children, ...props }, ref) => (
  <td ref={ref} className={cn(TD_BASE, className)} {...props}>
    {children}
  </td>
));
HKITd.displayName = "HKITd";
