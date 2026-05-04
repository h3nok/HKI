/**
 * SidebarSearch — Enterprise-grade search input for conversation sidebar
 *
 * Design goals:
 * - High contrast in both light and dark mode (explicit border + elevated bg)
 * - Cmd+K shortcut badge with proper visibility
 * - Result count badge and clear button
 * - Focus ring, hover state, transition animations
 * - Fully accessible with aria-label
 *
 * @module task-sidebar/sidebar-search
 */

import { forwardRef, useCallback } from 'react';
import { Search, X, Command } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface SidebarSearchProps {
  /** Current search value (controlled) */
  value: string;
  /** Search change handler */
  onChange: (value: string) => void;
  /** Number of filtered results to display as badge */
  resultCount?: number;
  /** Show result count badge when true */
  showResultCount?: boolean;
  /** Compact mode for collapsed sidebar (icon-only) */
  compact?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** CSS class override */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const SidebarSearch = forwardRef<HTMLInputElement, SidebarSearchProps>(
  function SidebarSearch(
    {
      value,
      onChange,
      resultCount,
      showResultCount = false,
      compact = false,
      placeholder = 'Search tasks…',
      className,
    },
    ref
  ) {
    const handleClear = useCallback(() => {
      onChange('');
      // Re-focus the input after clearing
      if (ref && 'current' in ref) ref.current?.focus();
    }, [onChange, ref]);

    // ── Compact: icon-only trigger ──
    if (compact) {
      return (
        <button
          type="button"
          className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl
                     text-sidebar-muted-foreground hover:text-sidebar-foreground
                     hover:bg-primary/8 transition-colors"
          aria-label="Search tasks"
          title="Search (⌘K)"
        >
          <Search className="w-4.5 h-4.5" />
        </button>
      );
    }

    // ── Full search input ──
    return (
      <div className={`relative group ${className ?? ''}`}>
        {/* Search icon — small and muted, vertically centered */}
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5
                     text-sidebar-muted-foreground/60 group-focus-within:text-sidebar-primary
                     transition-colors pointer-events-none"
          strokeWidth={1.8}
          aria-hidden
        />

        {/* Input — borderless by default, subtle fill, focus ring only */}
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Search tasks"
          className="
            w-full pl-8 pr-16 py-1.5 rounded-lg text-[13px]
            bg-sidebar-accent/40 dark:bg-sidebar-accent/50
            text-sidebar-foreground
            placeholder:text-sidebar-muted-foreground/60
            border border-transparent
            hover:bg-sidebar-accent/70 dark:hover:bg-sidebar-accent/70
            focus:outline-none focus:bg-sidebar-accent/80 dark:focus:bg-sidebar-accent/80
            focus:border-sidebar-primary/30 focus:ring-1 focus:ring-sidebar-primary/15
            transition-all duration-200
          "
        />

        {/* Right-side controls */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* Result count badge */}
          {value && showResultCount && resultCount !== undefined && (
            <span
              className="inline-flex items-center justify-center min-w-4 h-4 px-1
                         rounded text-[10px] font-medium tabular-nums leading-none
                         bg-sidebar-primary/12 text-sidebar-primary dark:bg-sidebar-primary/18"
            >
              {resultCount}
            </span>
          )}

          {/* Clear button */}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center justify-center w-4.5 h-4.5 rounded
                         text-sidebar-muted-foreground/60 hover:text-sidebar-foreground
                         hover:bg-primary/8 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {/* ⌘K shortcut badge — subtle, properly spaced */}
          {!value && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded
                         text-[10px] font-normal leading-none select-none
                         text-sidebar-muted-foreground/50"
            >
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </span>
          )}
        </div>
      </div>
    );
  }
);

export default SidebarSearch;
